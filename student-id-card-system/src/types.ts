export type Student = {
  id: string;
  name: string;
  parentage: string;
  className: string;
  dob: string;
  mobile: string;
  admissionNumber: string;
  photo?: string;
};

export type CardSettings = {
  widthCm: number;
  heightCm: number;
  gapMm: number;
  orientation: "landscape" | "portrait" | "auto";
  institutionName: string;
  subHeader: string;
  cardTitle: string;
};

export type AppSettings = {
  issueYear: string;
  card: CardSettings;
};

export type StoredState = {
  students: Student[];
  settings: AppSettings;
};

export const DEFAULT_CARD_SETTINGS: CardSettings = {
  widthCm: 10.4,
  heightCm: 7.0,
  gapMm: 4,
  orientation: "landscape",
  institutionName: "MODEL PUBLIC SCHOOL",
  subHeader: "DEPARTMENT OF EDUCATION",
  cardTitle: "STUDENT IDENTITY CARD",
};
