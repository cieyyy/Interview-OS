/// <reference types="vite/client" />

import type { InterviewOSApi } from '../shared/ipc';

declare global {
  interface Window {
    interviewOS: InterviewOSApi;
  }
}

export {};

