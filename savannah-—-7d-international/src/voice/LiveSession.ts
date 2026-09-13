import { bus } from '../state/bus';
import {
  LIVE_MODEL,
  SupportedLang,
  PrebuiltVoice,
  SESSION_CAP_MS,
  IDLE_WARNING_MS,
  IDLE_TIMEOUT_MS,
  SILENCE_CHIP_TRIGGER_MS,
} from '../config';
import { PlaybackManager } from './Playback';
import { MicCapture } from './MicCapture';
import { CaptionManager } from './captions';
import { strings } from '../i18n/strings';
import { TOOL_DECLARATIONS, executeToolCall } from './tools';
import { fetchKnowledgeBase } from '../kb/client';
import { storyController } from '../story/story';

export interface TurnHistory {
  role: 'user' | 'model';
  text: string;
}

export class LiveSession {
  private ws: WebSocket | null = null;
  public playback: PlaybackManager;
  public mic: MicCapture;
  public captions: CaptionManager;

  private lang: SupportedLang = 'en';
  private voice: PrebuiltVoice = 'Aoede';
  private isConnected = false;
  private isReconnecting = false;
  private isDestroyed = false;

  // History buffer for language switching (last 6 turns)
  private turnHistory: TurnHistory[] = [];
  private currentTurnText = { user: '', model: '' };

  // Timers
  private sessionCapTimer: number | null = null;
  private idleCheckInterval: number | null = null;
  private lastActivityTime = Date.now();
  private idleWarned = false;
  private reconnectAttempts = 0;

  // Silence timer for chips
  private silenceTimer: number | null = null;
  private onSilenceStateChange?: (showChips: boolean) => void;

  constructor(lang: SupportedLang, voice: PrebuiltVoice) {
    this.lang = lang;
    this.voice = voice;

    this.playback = new PlaybackManager();
    this.mic = new MicCapture();
    this.captions = new CaptionManager(() => this.playback.getCurrentTime());

    // Connect playback clock to captions
    this.playback.setOnAudioScheduled((startTime) => {
      // Audio chunk enqueued at estimated startTime
      this.resetSilenceTimer();
      this.lastActivityTime = Date.now();
      bus.emit('state', 'speaking');
    });
  }

  public setOnSilenceStateChange(cb: (showChips: boolean) => void) {
    this.onSilenceStateChange = cb;
  }

  public async start(seedHistory?: TurnHistory[]): Promise<void> {
    this.isDestroyed = false;
    bus.emit('state', 'thinking');
    bus.emit('lang', this.lang);

    if (seedHistory && seedHistory.length > 0) {
      this.turnHistory = seedHistory.slice(-6);
    }

    try {
      // Fetch ephemeral token from server
      const tokenRes = await fetch('/api/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: this.lang,
          voice: this.voice,
        }),
      });

      if (!tokenRes.ok) {
        const errorData = await tokenRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${tokenRes.status}`);
      }

      const data = await tokenRes.json();
      const tokenName = data.token;

      // Connect to Gemini Live Bidi WebSocket using the ephemeral token
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(
        tokenName
      )}`;

      await this.connectWebSocket(wsUrl);

      // Start microphone capture (gracefully handles environments without mic hardware)
      const micActive = await this.mic.start((pcm16Base64) => {
        this.sendAudioChunk(pcm16Base64);
        this.onUserActivity();
      });

      if (!micActive) {
        // If mic is unavailable, activate suggestion chips immediately so user can interact
        if (this.onSilenceStateChange) {
          this.onSilenceStateChange(true);
        }
      }

      this.startTimers();
      bus.emit('connected', true);
      bus.emit('reconnecting', false);
    } catch (err: any) {
      console.error('LiveSession start error:', err);
      bus.emit('error', err.message || 'Connection failed');
      bus.emit('state', 'idle');
      throw err;
    }
  }

  private connectWebSocket(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.isReconnecting = false;
          this.reconnectAttempts = 0;

          // Send setup message to Gemini Live
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                setup: {
                  model: `models/${LIVE_MODEL}`,
                  tools: [
                    {
                      functionDeclarations: TOOL_DECLARATIONS,
                    },
                  ],
                },
              })
            );

            // If we have seeded turn history (e.g. from language switch), inject context
            if (this.turnHistory.length > 0) {
              const turns = this.turnHistory.map((t) => ({
                role: t.role,
                parts: [{ text: t.text }],
              }));

              // Add instruction for language switch acknowledgment
              const switchNote =
                this.lang === 'ar'
                  ? 'تم تغيير لغة المحادثة إلى العربية. رحبي بالزائر بلهجة سعودية بيضاء راقية وأكدي له تحويل اللغة وسؤاله كيف تساعدينه.'
                  : 'Language has been switched to English. Greet the visitor warmly and confirm the switch.';

              turns.push({
                role: 'user',
                parts: [{ text: switchNote }],
              });

              this.ws.send(
                JSON.stringify({
                  clientContent: {
                    turns,
                    turnComplete: true,
                  },
                })
              );
            } else {
              // Initial greeting prompt so Savannah speaks first!
              const initialPrompt =
                this.lang === 'ar'
                  ? 'ابدأي المحادثة بتحية سعودية دافئة وراقية للزائر، وعرفي بنفسك كسافانا، المضيفة الذكية لشركة سفن دي إنترناشونال، واسألي كيف تقدرين تساعدينه.'
                  : 'Start the conversation by greeting the visitor warmly, introducing yourself as Savannah, the AI host for 7D International, and asking how you can guide them today.';

              this.ws.send(
                JSON.stringify({
                  clientContent: {
                    turns: [
                      {
                        role: 'user',
                        parts: [{ text: initialPrompt }],
                      },
                    ],
                    turnComplete: true,
                  },
                })
              );
            }
          }

          resolve();
        };

        this.ws.onmessage = (evt) => {
          this.handleServerMessage(evt.data);
        };

        this.ws.onerror = (err) => {
          console.error('LiveSession WebSocket error:', err);
          if (!this.isConnected) {
            reject(err);
          }
        };

        this.ws.onclose = (evt) => {
          this.isConnected = false;
          if (!this.isDestroyed) {
            console.warn('LiveSession WebSocket closed:', evt.code, evt.reason);
            this.attemptReconnect();
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleServerMessage(data: any) {
    try {
      const msg = typeof data === 'string' ? JSON.parse(data) : data;

      // Handle direct toolCall from Gemini Live API
      if (msg.toolCall && msg.toolCall.functionCalls) {
        this.handleFunctionCalls(msg.toolCall.functionCalls);
        return;
      }

      // Handle serverContent
      if (msg.serverContent) {
        const sc = msg.serverContent;

        // Interrupted barge-in from user speaking
        if (sc.interrupted) {
          this.playback.interrupt();
          this.captions.interrupt();
          storyController.pause();
          bus.emit('state', 'listening');
          bus.emit('interrupted', true);
          this.resetSilenceTimer();
          return;
        }

        // Model audio turn
        if (sc.modelTurn && sc.modelTurn.parts) {
          bus.emit('state', 'speaking');
          this.resetSilenceTimer();

          for (const part of sc.modelTurn.parts) {
            // Function call inside model turn part
            if (part.functionCall) {
              this.handleFunctionCalls([part.functionCall]);
            }
            // Audio data
            if (part.inlineData && part.inlineData.data) {
              this.playback.enqueuePcm16Base64(part.inlineData.data);
            }
            // Text data if provided
            if (part.text) {
              this.currentTurnText.model += part.text;
              this.captions.onModelTextChunk(part.text);
            }
          }
        }

        // Transcription for captions
        if (sc.outputAudioTranscription && sc.outputAudioTranscription.text) {
          const text = sc.outputAudioTranscription.text;
          this.currentTurnText.model += text;
          this.captions.onModelTextChunk(text);
        }

        if (sc.inputAudioTranscription && sc.inputAudioTranscription.text) {
          const text = sc.inputAudioTranscription.text;
          this.currentTurnText.user += text;
          this.captions.onUserTextChunk(text);
          this.onUserActivity();
        }

        // Turn complete
        if (sc.turnComplete) {
          if (this.currentTurnText.model) {
            this.turnHistory.push({ role: 'model', text: this.currentTurnText.model.trim() });
            this.currentTurnText.model = '';
          }
          if (this.currentTurnText.user) {
            this.turnHistory.push({ role: 'user', text: this.currentTurnText.user.trim() });
            this.currentTurnText.user = '';
          }
          // Cap turn history to 6 turns
          if (this.turnHistory.length > 6) {
            this.turnHistory = this.turnHistory.slice(-6);
          }

          // Check if playback is still active or completed
          setTimeout(() => {
            if (!this.playback.isPlaying()) {
              bus.emit('state', 'listening');
              this.resetSilenceTimer();
            }
          }, 300);
        }
      }

      // Handle goAway (graceful reconnection needed)
      if (msg.goAway) {
        console.log('Gemini Live sent goAway, reconnecting gracefully...');
        this.attemptReconnect();
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  }

  private async handleFunctionCalls(calls: any[]) {
    bus.emit('state', 'thinking');
    const functionResponses: any[] = [];

    for (const call of calls) {
      try {
        console.log(`[Savannah Tool Call] executing ${call.name} with args:`, call.args);
        const result = await executeToolCall(call.name, call.args || {}, this.lang);
        functionResponses.push({
          response: { output: result },
          id: call.id,
        });
      } catch (err: any) {
        console.error(`Error executing tool ${call.name}:`, err);
        functionResponses.push({
          response: { error: err.message || 'Tool execution failed' },
          id: call.id,
        });
      }
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN && functionResponses.length > 0) {
      this.ws.send(
        JSON.stringify({
          toolResponse: {
            functionResponses,
          },
        })
      );
    }
  }

  private sendAudioChunk(pcm16Base64: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: pcm16Base64,
            },
          ],
        },
      })
    );
  }

  public sendTextInput(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    bus.emit('state', 'thinking');
    bus.emit('userCaption', text);
    this.onUserActivity();

    this.ws.send(
      JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
          turnComplete: true,
        },
      })
    );
  }

  private onUserActivity() {
    this.lastActivityTime = Date.now();
    this.idleWarned = false;
    this.resetSilenceTimer();
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    if (this.onSilenceStateChange) {
      this.onSilenceStateChange(false);
    }

    // After 6s of silence while listening, float suggestion chips
    this.silenceTimer = window.setTimeout(() => {
      if (this.isConnected && !this.playback.isPlaying()) {
        if (this.onSilenceStateChange) {
          this.onSilenceStateChange(true);
        }
      }
    }, SILENCE_CHIP_TRIGGER_MS);
  }

  private startTimers() {
    // 10-minute session cap
    this.sessionCapTimer = window.setTimeout(() => {
      this.endSession('SESSION_CAP_REACHED');
    }, SESSION_CAP_MS);

    // Idle checks (90s warning, 120s timeout)
    this.idleCheckInterval = window.setInterval(() => {
      const idleTime = Date.now() - this.lastActivityTime;

      if (idleTime >= IDLE_TIMEOUT_MS) {
        this.endSession('IDLE_TIMEOUT');
      } else if (idleTime >= IDLE_WARNING_MS && !this.idleWarned) {
        this.idleWarned = true;
        const idlePrompt =
          this.lang === 'ar'
            ? strings.ar.idleQuestion
            : strings.en.idleQuestion;
        this.sendTextInput(idlePrompt);
      }
    }, 5000);
  }

  private async attemptReconnect() {
    if (this.isDestroyed || this.isReconnecting) return;
    this.isReconnecting = true;
    bus.emit('reconnecting', true);
    bus.emit('state', 'thinking');

    const delays = [500, 1000, 2000, 4000];
    const delay = delays[Math.min(this.reconnectAttempts, delays.length - 1)];
    this.reconnectAttempts++;

    await new Promise((res) => setTimeout(res, delay));

    try {
      await this.start(this.turnHistory);
    } catch (err) {
      console.error('Reconnection failed:', err);
      if (this.reconnectAttempts < 5) {
        this.isReconnecting = false;
        this.attemptReconnect();
      } else {
        bus.emit('error', 'CONNECTION_LOST');
        this.endSession('CONNECTION_LOST');
      }
    }
  }

  public async switchLanguage(newLang: SupportedLang) {
    if (this.lang === newLang) return;
    this.lang = newLang;
    bus.emit('lang', newLang);

    // Close current connection cleanly
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.playback.interrupt();
    this.captions.interrupt();

    // Reconnect with new language, preserving last 6 turns
    await this.start(this.turnHistory);
  }

  public endSession(reason: string = 'USER_ENDED') {
    this.isDestroyed = true;
    bus.emit('sessionEnded', true);
    bus.emit('state', 'idle');

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.playback.interrupt();
    this.mic.stop();
    this.captions.clear();

    if (this.sessionCapTimer) clearTimeout(this.sessionCapTimer);
    if (this.idleCheckInterval) clearInterval(this.idleCheckInterval);
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
  }

  public dispose() {
    this.endSession('DISPOSED');
    this.playback.dispose();
    this.captions.dispose();
  }
}
