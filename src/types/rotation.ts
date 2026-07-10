export interface RotationRequirement {
  id: string;
  name: string;
  category:
    | "Ward"
    | "ICU"
    | "Night Float"
    | "Ambulatory"
    | "Elective"
    | "Consult"
    | "Jeopardy"
    | "Vacation"
    | "Admission"
    | "Other";
  requiredPGY1: number;
  requiredPGY2: number;
  requiredPGY3: number;
  requiredSenior: number;
  active: boolean;
  displayOrder: number;
}