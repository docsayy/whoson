import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { db } from "../config/firebase";
import type { ScheduleService } from "../types/schedule";

const servicesCollection = collection(db, "services");

export async function getServices(): Promise<ScheduleService[]> {
  const q = query(servicesCollection, orderBy("displayOrderAll", "asc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...(docSnap.data() as Omit<ScheduleService, "id">),
  }));
}

function attendingService(
  id: string,
  name: string,
  shortName: string,
  order: number,
  attendingScheduleType: "Core" | "Specialty",
  visibleOnCall: boolean
): ScheduleService {
  return {
    id,
    name,
    shortName,
    category: attendingScheduleType === "Core" ? "Attending" : "Consulting",
    coverageGroup: "Attending",
    attendingScheduleType,
    requiredTraining: ["Attending"],
    defaultStartTime: "07:00",
    defaultEndTime: "07:00",
    displayOrderCall: order,
    displayOrderAll: order,
    visibleOnCall,
    visibleOnAllServices: true,
    active: true,
  };
}

export async function seedDefaultServices() {
  const services: ScheduleService[] = [
    attendingService(
      "tele-2n-ccu-attending-call",
      "2N2 (Tele), 2N1, CCU Attending on Call",
      "Tele/2N/CCU Attending",
      101,
      "Core",
      true
    ),
    attendingService(
      "observation-attending",
      "Observation",
      "Observation",
      102,
      "Core",
      true
    ),
    attendingService(
      "4n-3w-attending-record",
      "4 North 1&2, 3W Attending On Record",
      "4N/3W AOR",
      103,
      "Core",
      true
    ),
    attendingService(
      "4n-3w-attending-call",
      "4 North 1&2, 3W Attending On Call",
      "4N/3W Call",
      104,
      "Core",
      true
    ),
    attendingService(
      "faculty-attending-call",
      "Faculty Attending On Call",
      "Faculty Call",
      105,
      "Core",
      true
    ),
    attendingService(
      "admitting-panel",
      "Admitting Panel",
      "Admitting Panel",
      106,
      "Core",
      true
    ),

    attendingService("gi-on-call", "Gastroenterology On Call", "GI", 201, "Specialty", false),
    attendingService("neurology-on-call", "Neurology On Call", "Neurology", 202, "Specialty", false),
    attendingService("cardiology-on-call", "Cardiology On Call", "Cardiology", 203, "Specialty", false),
    attendingService("pulmonology-on-call", "Pulmonary On Call", "Pulmonary", 204, "Specialty", false),
    attendingService("micu-attending-on-call", "MICU Attending On Call", "MICU", 205, "Specialty", false),
    attendingService("infectious-disease-on-call", "Infectious Disease On Call", "ID", 206, "Specialty", false),
    attendingService("nephrology-on-call", "Nephrology On Call", "Nephrology", 207, "Specialty", false),
    attendingService("rheumatology-on-call", "Rheumatology On Call", "Rheumatology", 208, "Specialty", false),
    attendingService("hematology-on-call", "Hematology On Call", "Hematology", 209, "Specialty", false),
  ];

  for (const service of services) {
    const { id, ...data } = service;
    await setDoc(doc(db, "services", id), data, { merge: true });
  }
}