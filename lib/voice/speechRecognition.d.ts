interface SpeechRecognitionEventMap {
  audioend: Event;
  audiostart: Event;
  end: Event;
  error: SpeechRecognitionErrorEvent;
  nomatch: SpeechRecognitionEvent;
  result: SpeechRecognitionEvent;
  soundend: Event;
  soundstart: Event;
  speechend: Event;
  speechstart: Event;
  start: Event;
}

type SpeechRecognitionAvailabilityStatus = 'unavailable' | 'downloadable' | 'downloading' | 'available';

type SpeechRecognitionOptions = {
  langs: string[];
  processLocally?: boolean;
};

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  addEventListener<K extends keyof SpeechRecognitionEventMap>(
    type: K,
    listener: (this: SpeechRecognition, event: SpeechRecognitionEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

type SpeechRecognitionConstructor = {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
  available?(options: SpeechRecognitionOptions): Promise<SpeechRecognitionAvailabilityStatus>;
  install?(options: SpeechRecognitionOptions): Promise<boolean>;
};

declare var SpeechRecognition: SpeechRecognitionConstructor | undefined;
declare var webkitSpeechRecognition: SpeechRecognitionConstructor | undefined;
