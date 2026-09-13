import { bus } from '../state/bus';

export interface StoryChapter {
  number: number;
  id: string;
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  script_en: string;
  script_ar: string;
  toolToCall: { name: string; args: any };
  suggestedNext: { en: string[]; ar: string[] };
}

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    number: 1,
    id: 'ch-spark',
    title_en: 'The Spark (1993)',
    title_ar: 'الشرارة الأولى (١٩٩٣)',
    subtitle_en: 'Ostrava, Central Europe — Atelier Simona',
    subtitle_ar: 'أوسترافا، وسط أوروبا — أتيليه سيمونا',
    script_en:
      'Our journey began in 1993 in Ostrava, Czech Republic, where architect Roman Kuba founded Atelier Simona. Guided by rigorous European craft and structural integrity, that early studio became the design foundation of everything 7D is today.',
    script_ar:
      'انطلقت رحلتنا عام ١٩٩٣ في أوسترافا بجمهورية التشيك، يوم أسس المعماري رومان كوبا أتيليه سيمونا. بحرفية أوروبية دقيقة وإتقان إنشائي، صار هذا الاستوديو الركيزة المعمارية لكل ما تمثله سفن دي اليوم.',
    toolToCall: { name: 'show_person', args: { id: 'roman-kuba' } },
    suggestedNext: {
      en: ['Next chapter', 'Who was Roman Kuba?', 'Stop story'],
      ar: ['الفصل التالي', 'مين رومان كوبا؟', 'وقف القصة'],
    },
  },
  {
    number: 2,
    id: 'ch-continental',
    title_en: 'The Continental Arc',
    title_ar: 'الامتداد القاري',
    subtitle_en: '1,500+ Base Stations across Europe & Australasia',
    subtitle_ar: 'أكثر من ١,٥٠٠ محطة اتصالات في أوروبا وأسترالاسيا',
    script_en:
      'As our expertise grew, we expanded across Europe and into Australasia, delivering turnkey telecommunications infrastructure. We engineered over 1,500 cellular base stations across challenging terrains, completing over eighty million dollars in infrastructure contracts.',
    script_ar:
      'مع توسع خبرتنا، امتدت أعمالنا عبر أوروبا وصولاً إلى أسترالاسيا لتنفيذ مشاريع بنية تحتية حيوية. نفّذنا أكثر من ألف وخمسمية محطة اتصالات خلوية في تضاريس جغرافية صعبة، بعقود بلغت قيمتها ثمانين مليون دولار.',
    toolToCall: { name: 'show_figure', args: { id: 'fig-1500-base-stations' } },
    suggestedNext: {
      en: ['Next chapter', 'What about Saudi Arabia?', 'Previous chapter'],
      ar: ['الفصل التالي', 'وماذا عن السعودية؟', 'الفصل السابق'],
    },
  },
  {
    number: 3,
    id: 'ch-kingdom',
    title_en: 'Meeting the Kingdom',
    title_ar: 'الانطلاق في المملكة',
    subtitle_en: 'Riyadh Middle East Headquarters',
    subtitle_ar: 'المقر الإقليمي في الرياض',
    script_en:
      'Entering Saudi Arabia marked a defining chapter for 7D. Establishing our Middle East headquarters in Riyadh aligned our international expertise with the Kingdom’s visionary transformation, creating a permanent bridge between East and West.',
    script_ar:
      'دخولنا إلى المملكة العربية السعودية كان محطة فارقة لسفن دي. تأسيس مقرنا الإقليمي في الرياض ربط خبراتنا العالمية بالتحول الطموح للمملكة، وصنع جسراً دائماً يربط الشرق بالغرب.',
    toolToCall: { name: 'show_hubs', args: { focus: 'riyadh' } },
    suggestedNext: {
      en: ['Next chapter', 'What was your first project?', 'Tell me about the hubs'],
      ar: ['الفصل التالي', 'وش كان أول مشروع؟', 'احكي لي عن المراكز'],
    },
  },
  {
    number: 4,
    id: 'ch-water-light',
    title_en: 'Water & Light in Al-Malaz',
    title_ar: 'الماء والضوء في الملز',
    subtitle_en: 'King Abdullah Park Dancing Fountain',
    subtitle_ar: 'نافورة منتزه الملك عبدالله بالملز',
    script_en:
      'In Riyadh’s historic Al-Malaz, we executed the landmark multimedia dancing fountain at King Abdullah Park, partnering with PF Korea and Gawdat Group. It became a beloved civic icon, marrying authentic Saudi character with state-of-the-art hydraulic choreography.',
    script_ar:
      'في حي الملز التاريخي بالرياض، نفّذنا النافورة الراقصة الأيقونية في منتزه الملك عبدالله بالشراكة مع بي إف كوريا ومجموعة جودت. أصبحت معلماً حضرياً يجمع بين الطابع السعودي الأصيل وأحدث تقنيات العروض المائية.',
    toolToCall: { name: 'show_project', args: { id: 'king-abdullah-park-fountain' } },
    suggestedNext: {
      en: ['Next chapter', 'Who was PF Korea?', 'Tell me about the gardens'],
      ar: ['الفصل التالي', 'مين بي إف كوريا؟', 'احكي لي عن الحدائق'],
    },
  },
  {
    number: 5,
    id: 'ch-botanical',
    title_en: 'Botanical Horizons',
    title_ar: 'آفاق الطبيعة والتاريخ',
    subtitle_en: 'King Abdullah International Gardens Launch',
    subtitle_ar: 'إطلاق حدائق الملك عبدالله العالمية',
    script_en:
      'Our team was privileged to launch the visionary King Abdullah International Gardens project in Riyadh. Designed to showcase the paleobotanic history of the Arabian Peninsula across geological ages, it stands as a global testament to biodiversity and eco-tourism.',
    script_ar:
      'تشرفنا بالمشاركة في إطلاق مشروع حدائق الملك عبدالله العالمية بالرياض. صُمم ليعرض التاريخ النباتي القديم للجزيرة العربية عبر العصور الجيولوجية، كصرح عالمي للتنوع الحيوي والسياحة البيئية.',
    toolToCall: { name: 'show_project', args: { id: 'king-abdullah-international-gardens' } },
    suggestedNext: {
      en: ['Next chapter', 'What are your disciplines?', 'Previous chapter'],
      ar: ['الفصل التالي', 'وش تخصصاتكم؟', 'الفصل السابق'],
    },
  },
  {
    number: 6,
    id: 'ch-disciplines',
    title_en: 'Seven Disciplines, Five Hubs',
    title_ar: 'سبعة تخصصات، خمسة مراكز',
    subtitle_en: 'Riyadh, Florida, Ostrava, Seoul & Sydney',
    subtitle_ar: 'الرياض، فلوريدا، أوسترافا، سيول، وسيدني',
    script_en:
      'Today, 7D operates across seven core disciplines—from master planning and structural engineering to water spectacles and strategic consortiums. Our five hubs in Riyadh, Florida, Ostrava, Seoul, and Sydney work as one integrated multidisciplinary engine.',
    script_ar:
      'اليوم تعمل سفن دي عبر سبعة تخصصات رئيسية، من التخطيط الشامل والهندسة الإنشائية إلى النوافير الكبرى وتطوير التحالفات. مراكزنا الخمسة في الرياض، فلوريدا، أوسترافا، سيول، وسيدني تعمل كمنظومة متكاملة.',
    toolToCall: { name: 'show_hubs', args: { focus: 'florida' } },
    suggestedNext: {
      en: ['Final chapter', 'Tell me about Florida', 'Previous chapter'],
      ar: ['الفصل الأخير', 'احكي لي عن فلوريدا', 'الفصل السابق'],
    },
  },
  {
    number: 7,
    id: 'ch-future',
    title_en: 'The Riyadh Horizon',
    title_ar: 'أفق الرياض والمستقبل',
    subtitle_en: 'Takween Alrajhi Partnership & Riyadh Eye',
    subtitle_ar: 'شراكة تكوين الراجحي ومفهوم عين الرياض',
    script_en:
      'Looking forward, our strategic alliance with Takween Alrajhi and visionary concepts like the Riyadh Eye observation wheel reflect our enduring commitment to Saudi Arabia’s future. We continue to turn audacious civic visions into enduring realities.',
    script_ar:
      'تطلعاً للمستقبل، تعكس شراكتنا الاستراتيجية مع تكوين الراجحي ومفاهيمنا الجريئة مثل عجلة عين الرياض التزامنا الراسخ بمستقبل المملكة، لنواصل تحويل الرؤى الحضرية الطموحة إلى واقع ملموس.',
    toolToCall: { name: 'show_project', args: { id: 'riyadh-eye' } },
    suggestedNext: {
      en: ['What did you do in Riyadh?', 'How do I contact 7D?', 'Restart story'],
      ar: ['وش سويتوا في الرياض؟', 'كيف أتواصل مع سفن دي؟', 'أعد القصة'],
    },
  },
];

export type StoryStatus = 'idle' | 'playing' | 'paused' | 'done';

export class StoryController {
  private currentChapterIndex = 0;
  private status: StoryStatus = 'idle';

  public getStatus(): StoryStatus {
    return this.status;
  }

  public getCurrentChapter(): StoryChapter {
    return STORY_CHAPTERS[this.currentChapterIndex];
  }

  public getProgress(): { current: number; total: number; percent: number } {
    const total = STORY_CHAPTERS.length;
    const current = this.currentChapterIndex + 1;
    return {
      current,
      total,
      percent: Math.round((current / total) * 100),
    };
  }

  public start(): StoryChapter {
    this.currentChapterIndex = 0;
    this.status = 'playing';
    this.emitState();
    return this.getCurrentChapter();
  }

  public next(): StoryChapter | null {
    if (this.currentChapterIndex < STORY_CHAPTERS.length - 1) {
      this.currentChapterIndex++;
      this.status = 'playing';
      this.emitState();
      return this.getCurrentChapter();
    } else {
      this.status = 'done';
      this.emitState();
      return null;
    }
  }

  public previous(): StoryChapter {
    if (this.currentChapterIndex > 0) {
      this.currentChapterIndex--;
    }
    this.status = 'playing';
    this.emitState();
    return this.getCurrentChapter();
  }

  public pause(): void {
    if (this.status === 'playing') {
      this.status = 'paused';
      this.emitState();
    }
  }

  public resume(): StoryChapter {
    this.status = 'playing';
    this.emitState();
    return this.getCurrentChapter();
  }

  public stop(): void {
    this.status = 'idle';
    this.currentChapterIndex = 0;
    this.emitState();
  }

  public jump(chapterNumber: number): StoryChapter {
    const targetIdx = Math.max(0, Math.min(STORY_CHAPTERS.length - 1, chapterNumber - 1));
    this.currentChapterIndex = targetIdx;
    this.status = 'playing';
    this.emitState();
    return this.getCurrentChapter();
  }

  private emitState(): void {
    bus.emit('story_state', {
      status: this.status,
      currentChapter: this.currentChapterIndex + 1,
      totalChapters: STORY_CHAPTERS.length,
      chapter: this.getCurrentChapter(),
      progress: this.getProgress(),
    });
  }
}

export const storyController = new StoryController();
