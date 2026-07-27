export type PinKind = 'adventure' | 'todo';

export interface Photo {
  id: string;
  /** Full-size (resized) JPEG data URL. */
  full: string;
  /** Small square-ish thumbnail data URL, used in lists and grids. */
  thumb: string;
}

export interface Pin {
  id: string;
  kind: PinKind;
  name: string;
  description: string;
  /** ISO date (yyyy-mm-dd). Adventures only. */
  date: string;
  lat: number;
  lng: number;
  /** Governorate name, auto-detected from coordinates. '' when outside Lebanon. */
  governorate: string;
  cover: Photo | null;
  photos: Photo[];
  /** Todo pins can be checked off. */
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

/** The shape the editor form works with before it becomes a Pin. */
export interface PinDraft {
  id?: string;
  kind: PinKind;
  name: string;
  description: string;
  date: string;
  lat: number;
  lng: number;
  cover: Photo | null;
  photos: Photo[];
  done: boolean;
}
