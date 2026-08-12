export type CoverageView = "calls" | "all";

export type CoverageRow = {
  service: string;
  shift: string;
  name: string;
  training: "PGY-1" | "PGY-2" | "PGY-3" | "Attending";
  contact: string;
  messageReady: boolean;
  note?: string;
  view: CoverageView[];
};

export const coverageRows: CoverageRow[] = [
  { service: "2N-CCU", shift: "7a-7p", name: "Gandapur", training: "PGY-1", contact: "11279", messageReady: true, view: ["calls"] },
  { service: "4N", shift: "7a-7p", name: "Sallam", training: "PGY-1", contact: "11287", messageReady: true, view: ["calls"] },
  { service: "4N-3W PGY2", shift: "7a-7p", name: "Ali", training: "PGY-2", contact: "11155", messageReady: true, view: ["calls"] },
  { service: "3W", shift: "7a-7p", name: "Muslehuddin", training: "PGY-1", contact: "11285", messageReady: true, view: ["calls"] },
  { service: "Tele", shift: "7a-7p", name: "Al-Gharazi", training: "PGY-1", contact: "11273", messageReady: true, view: ["calls"] },
  { service: "MICU", shift: "7a-7a", name: "Burdynskyi", training: "PGY-1", contact: "11275", messageReady: true, view: ["calls", "all"] },
  { service: "MICU Senior", shift: "8a-8a", name: "Najera", training: "PGY-2", contact: "11165", messageReady: true, view: ["calls", "all"] },
  { service: "4N-3W PGY1 NF", shift: "7p-7a", name: "Kodwo", training: "PGY-1", contact: "11282", messageReady: true, view: ["calls"] },
  { service: "4N-3W PGY2 NF", shift: "7p-7a", name: "Chekalil", training: "PGY-2", contact: "11161", messageReady: true, view: ["calls"] },
  { service: "Chief On Call", shift: "7a-7p", name: "Al-Hashimi", training: "PGY-3", contact: "534", messageReady: false, view: ["calls"] },
  { service: "PGY3 NF", shift: "7p-7a", name: "Rahman", training: "PGY-3", contact: "541", messageReady: true, view: ["calls"] },

  { service: "Vac", shift: "", name: "Brazan", training: "PGY-2", contact: "11162", messageReady: true, view: ["all"] },
  { service: "Vac", shift: "", name: "Kasteri", training: "PGY-1", contact: "11266", messageReady: false, view: ["all"] },
  { service: "Vac", shift: "", name: "Llerena", training: "PGY-1", contact: "11267", messageReady: true, view: ["all"] },

  { service: "2N", shift: "", name: "Valle", training: "PGY-2", contact: "11171", messageReady: true, note: "On call for 2N-CCU PGY2", view: ["all"] },
  { service: "2N", shift: "", name: "Chudasama", training: "PGY-1", contact: "11277", messageReady: true, view: ["all"] },
  { service: "2N", shift: "", name: "Japhe", training: "PGY-1", contact: "11280", messageReady: true, view: ["all"] },
  { service: "2N", shift: "", name: "Park", training: "PGY-1", contact: "11268", messageReady: true, view: ["all"] },

  { service: "4N", shift: "", name: "Zhao", training: "PGY-3", contact: "547", messageReady: true, view: ["all"] },
  { service: "4N", shift: "", name: "Rodriguez", training: "PGY-2", contact: "11167", messageReady: true, view: ["all"] },
  { service: "4N", shift: "", name: "Finn", training: "PGY-1", contact: "11264", messageReady: true, view: ["all"] },
  { service: "4N", shift: "", name: "Rabby", training: "PGY-1", contact: "11286", messageReady: true, view: ["all"] },
  { service: "4N", shift: "", name: "Sallam", training: "PGY-1", contact: "11287", messageReady: true, view: ["all"] },
  { service: "4N", shift: "", name: "Bernate", training: "PGY-1", contact: "11258", messageReady: true, view: ["all"] },

  { service: "Tele", shift: "", name: "Desai", training: "PGY-3", contact: "522", messageReady: false, view: ["all"] },
  { service: "Tele", shift: "", name: "Sayyar", training: "PGY-2", contact: "11170", messageReady: false, view: ["all"] },
  { service: "Tele", shift: "", name: "Dam", training: "PGY-1", contact: "11278", messageReady: true, view: ["all"] },
  { service: "Tele", shift: "", name: "Maharjan", training: "PGY-1", contact: "11283", messageReady: true, view: ["all"] },
  { service: "Tele", shift: "", name: "Mehmood", training: "PGY-1", contact: "11284", messageReady: true, view: ["all"] },

  { service: "Pulm", shift: "", name: "Najera", training: "PGY-2", contact: "11165", messageReady: true, view: ["all"] },
  { service: "Pulm", shift: "", name: "Sadia", training: "PGY-2", contact: "11168", messageReady: true, view: ["all"] },

  { service: "CCU", shift: "", name: "Sayeed", training: "PGY-2", contact: "11169", messageReady: true, note: "Postcall for 2N-CCU PGY2", view: ["all"] },

  { service: "Amb", shift: "", name: "Faridizad", training: "PGY-3", contact: "538", messageReady: true, view: ["all"] },
  { service: "Amb", shift: "", name: "Kelly", training: "PGY-3", contact: "525", messageReady: true, note: "Postcall for Chief On Call", view: ["all"] },
  { service: "Amb", shift: "", name: "MK", training: "PGY-3", contact: "537", messageReady: false, view: ["all"] },
  { service: "Amb", shift: "", name: "Bari", training: "PGY-2", contact: "11158", messageReady: true, view: ["all"] },
  { service: "Amb", shift: "", name: "Alias", training: "PGY-1", contact: "11261", messageReady: true, view: ["all"] },
  { service: "Amb", shift: "", name: "Amin", training: "PGY-1", contact: "11263", messageReady: true, view: ["all"] },
  { service: "Amb", shift: "", name: "RodriguezL", training: "PGY-1", contact: "11270", messageReady: true, view: ["all"] },

  { service: "ID", shift: "", name: "Tasnim", training: "PGY-3", contact: "546", messageReady: true, view: ["all"] },
  { service: "ID", shift: "", name: "Gandapur", training: "PGY-1", contact: "11279", messageReady: true, view: ["all"] },

  { service: "Neuro", shift: "", name: "Asghar", training: "PGY-2", contact: "11157", messageReady: true, note: "Postcall for 4N-3W PGY2", view: ["all"] },

  { service: "NF", shift: "", name: "Rahman", training: "PGY-3", contact: "541", messageReady: true, view: ["all"] },
  { service: "NF", shift: "", name: "Alnadi", training: "PGY-2", contact: "11156", messageReady: true, view: ["all"] },
  { service: "NF", shift: "", name: "Chekalil", training: "PGY-2", contact: "11161", messageReady: true, view: ["all"] },
  { service: "NF", shift: "", name: "RKhan", training: "PGY-1", contact: "11281", messageReady: true, view: ["all"] },
  { service: "NF", shift: "", name: "Kodwo", training: "PGY-1", contact: "11282", messageReady: true, view: ["all"] },

  { service: "ER", shift: "", name: "Khachatryan", training: "PGY-3", contact: "536", messageReady: true, view: ["all"] },
  { service: "ER", shift: "", name: "Poursadrolah", training: "PGY-3", contact: "539", messageReady: false, view: ["all"] },

  { service: "Cardio", shift: "", name: "Khalid", training: "PGY-2", contact: "11164", messageReady: true, view: ["all"] },

  { service: "3W", shift: "", name: "Rafiq", training: "PGY-3", contact: "540", messageReady: false, view: ["all"] },
  { service: "3W", shift: "", name: "Catak", training: "PGY-1", contact: "11276", messageReady: true, view: ["all"] },
  { service: "3W", shift: "", name: "Muslehuddin", training: "PGY-1", contact: "11285", messageReady: true, view: ["all"] },

  { service: "MICU", shift: "", name: "SherKhan", training: "PGY-2", contact: "31748", messageReady: true, view: ["all"] },
  { service: "MICU", shift: "", name: "WangC", training: "PGY-2", contact: "11153", messageReady: true, view: ["all"] },
  { service: "MICU", shift: "", name: "Alfardous", training: "PGY-1", contact: "11272", messageReady: false, view: ["all"] },
  { service: "MICU", shift: "", name: "Alomari", training: "PGY-1", contact: "11274", messageReady: true, view: ["all"] },
  { service: "MICU", shift: "", name: "Burdynskyi", training: "PGY-1", contact: "11275", messageReady: true, view: ["all"] },
  { service: "MICU", shift: "", name: "Rizvi", training: "PGY-1", contact: "11269", messageReady: true, view: ["all"] },

  { service: "GI", shift: "", name: "Ali", training: "PGY-2", contact: "11155", messageReady: true, note: "On call for 4N-3W PGY2", view: ["all"] },
  { service: "2NC", shift: "", name: "Kaur", training: "PGY-2", contact: "11163", messageReady: true, view: ["all"] },
  { service: "Heme-onc", shift: "", name: "Al-Hashimi", training: "PGY-3", contact: "534", messageReady: false, note: "On call for Chief On Call", view: ["all"] },
  { service: "Nephro", shift: "", name: "Shaabani", training: "PGY-3", contact: "543", messageReady: false, view: ["all"] },
  { service: "Admission", shift: "", name: "Patel", training: "PGY-2", contact: "11166", messageReady: true, view: ["all"] },
  { service: "Elective", shift: "", name: "Burrola-Suarez", training: "PGY-3", contact: "520", messageReady: true, view: ["all"] },
  { service: "Elective", shift: "", name: "Sekhon", training: "PGY-3", contact: "542", messageReady: true, view: ["all"] },
  { service: "Vacation", shift: "", name: "Cappas", training: "PGY-3", contact: "535", messageReady: true, view: ["all"] },
  { service: "Vacation", shift: "", name: "Shahzadi", training: "PGY-3", contact: "544", messageReady: true, view: ["all"] },
  { service: "ADM", shift: "", name: "Al-Gharazi", training: "PGY-1", contact: "11273", messageReady: true, view: ["all"] },
  { service: "JEO", shift: "", name: "Adhikari", training: "PGY-1", contact: "11271", messageReady: true, view: ["all"] },
  { service: "Opht", shift: "", name: "Goodfriend", training: "PGY-1", contact: "11265", messageReady: true, view: ["all"] },

  { service: "Observation Attending", shift: "7a-7a", name: "Algohary", training: "Attending", contact: "", messageReady: false, view: ["calls"] },
  { service: "Faculty Attending On Call", shift: "7a-7a", name: "Akbar Khan", training: "Attending", contact: "", messageReady: false, view: ["calls"] },
];