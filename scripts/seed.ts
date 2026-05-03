/**
 * Seed a richly intermarried 5-family, 6-generation dataset.
 *
 * Families: Nimbal, Betageri, Deshpande, Kulkarni, Joshi.
 * Generations (approx birth year ranges):
 *   G1 1860s-1870s | G2 1890s-1900s | G3 1917-1932 |
 *   G4 1945-1958   | G5 1975-1985   | G6 2008-2012
 *
 * Intermarriage highlights (create multi-path relationships):
 *   - G1 cross-family siblings: Gangabai (née Kulkarni) sister of Shankar Kulkarni;
 *     Laxmibai (née Joshi) sister of Balwant Joshi. These sibling edges alone
 *     tie Nimbal<->Kulkarni and Deshpande<->Joshi at the root.
 *   - G2 Dravidian-style cross-cousin unions: Ramchandra Nimbal marries his
 *     mother's-brother's-daughter Radha Kulkarni; Madhav Joshi marries his
 *     father's-sister's-daughter Yamuna Deshpande.
 *   - G3 layered intermarriages further binding Betageri<->Nimbal<->Kulkarni
 *     <->Deshpande<->Joshi, including an explicit first-cousin marriage
 *     (Dinkar Joshi x Nalini Betageri) where Dinkar's aunt Kamala is Nalini's
 *     mother -- making their future descendants doubly related.
 *   - G4 "sibling-swap" marriages that produce double-first-cousins:
 *       Pradeep Joshi x Sushma Betageri AND Milind Betageri x Anjali Joshi
 *       (Pradeep-Anjali are siblings; Milind-Sushma are siblings)
 *       -> Aarti (y4 daughter) and Akshay/Neha (y6 kids) are DOUBLE first cousins.
 *   - G5 maternal cross-cousin marriage: Rohit Joshi x Rohini Deshpande, where
 *     Rohit's mother Kavita is Rohini's father Vijay's sister.
 *       -> Vijay Deshpande is BOTH Rohit's maternal uncle AND his father-in-law.
 *       -> Kavita is BOTH Rohini's aunt AND her mother-in-law.
 *   - G4/G5 intermarriages distribute the blood across all five surnames so
 *     any two modern descendants usually have 2+ relationship paths.
 *
 * Running this script will DELETE all existing Person and Family data.
 */
import neo4j, { Driver } from "neo4j-driver";
import { randomUUID } from "crypto";

const URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const USER = process.env.NEO4J_USER || "neo4j";
const PASSWORD = process.env.NEO4J_PASSWORD || "vamsha_dev_password";
const DATABASE = process.env.NEO4J_DATABASE; // optional; required on Aura

type Gender = "male" | "female";

interface PersonSpec {
  key: string;
  fullName: string;
  familyName: string;
  gender: Gender;
  dateOfBirth?: string;
  dateOfDeath?: string;
  city?: string;
  occupation?: string;
  education?: string;
  additionalNotes?: string;
}

interface CoupleSpec {
  husband: string;
  wife: string;
  marriageDate?: string;
  children: string[];
}

const persons: PersonSpec[] = [
  // ============================ G1 ============================
  {
    key: "krishnarao_nimbal",
    fullName: "Krishnarao Nimbal",
    familyName: "Nimbal",
    gender: "male",
    dateOfBirth: "1865-03-12",
    dateOfDeath: "1945-08-20",
    city: "Nimbal",
    occupation: "Landowner",
    additionalNotes: "Patriarch of the Nimbal line; known for donating land for the village school.",
  },
  {
    key: "gangabai_nimbal",
    fullName: "Gangabai Nimbal",
    familyName: "Nimbal",
    gender: "female",
    dateOfBirth: "1870-07-04",
    dateOfDeath: "1948-01-15",
    city: "Nimbal",
    additionalNotes: "Née Kulkarni; sister of Shankar Kulkarni. This marriage forges the Nimbal-Kulkarni bond.",
  },
  {
    key: "vishnu_betageri",
    fullName: "Vishnu Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1867-11-23",
    dateOfDeath: "1942-06-10",
    city: "Hubli",
    occupation: "Temple priest",
  },
  {
    key: "radhabai_betageri",
    fullName: "Radhabai Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "1872-01-02",
    dateOfDeath: "1950-09-09",
    city: "Hubli",
  },
  {
    key: "narayan_deshpande",
    fullName: "Narayan Deshpande",
    familyName: "Deshpande",
    gender: "male",
    dateOfBirth: "1866-05-19",
    dateOfDeath: "1943-12-01",
    city: "Dharwad",
    occupation: "Revenue officer",
  },
  {
    key: "laxmibai_deshpande",
    fullName: "Laxmibai Deshpande",
    familyName: "Deshpande",
    gender: "female",
    dateOfBirth: "1871-08-15",
    dateOfDeath: "1952-02-28",
    city: "Dharwad",
    additionalNotes: "Née Joshi; sister of Balwant Joshi. Origin of the Deshpande-Joshi bond.",
  },
  {
    key: "shankar_kulkarni",
    fullName: "Shankar Kulkarni",
    familyName: "Kulkarni",
    gender: "male",
    dateOfBirth: "1862-09-30",
    dateOfDeath: "1938-05-05",
    city: "Belgaum",
    occupation: "Headmaster",
  },
  {
    key: "saraswati_kulkarni",
    fullName: "Saraswati Kulkarni",
    familyName: "Kulkarni",
    gender: "female",
    dateOfBirth: "1867-12-25",
    dateOfDeath: "1945-11-11",
    city: "Belgaum",
  },
  {
    key: "balwant_joshi",
    fullName: "Balwant Joshi",
    familyName: "Joshi",
    gender: "male",
    dateOfBirth: "1868-04-07",
    dateOfDeath: "1949-03-03",
    city: "Pune",
    occupation: "Sanskrit scholar",
  },
  {
    key: "indirabai_joshi",
    fullName: "Indirabai Joshi",
    familyName: "Joshi",
    gender: "female",
    dateOfBirth: "1874-06-14",
    dateOfDeath: "1951-10-27",
    city: "Pune",
  },

  // ============================ G2 ============================
  {
    key: "ramchandra_nimbal",
    fullName: "Ramchandra Nimbal",
    familyName: "Nimbal",
    gender: "male",
    dateOfBirth: "1892-02-14",
    dateOfDeath: "1968-07-22",
    city: "Hubli",
    occupation: "Advocate",
    education: "LL.B., Fergusson College",
    additionalNotes: "Married his maternal cross-cousin Radha Kulkarni (traditional Dravidian preferred match).",
  },
  {
    key: "tulsibai_nimbal",
    fullName: "Tulsibai Nimbal",
    familyName: "Nimbal",
    gender: "female",
    dateOfBirth: "1895-10-03",
    dateOfDeath: "1970-03-15",
    city: "Hubli",
    additionalNotes: "Married into the Betageri family.",
  },
  {
    key: "keshav_betageri",
    fullName: "Keshav Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1893-06-11",
    dateOfDeath: "1965-11-04",
    city: "Hubli",
    occupation: "Temple priest",
  },
  {
    key: "shivaram_betageri",
    fullName: "Shivaram Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1898-09-22",
    dateOfDeath: "1975-04-18",
    city: "Dharwad",
    occupation: "Schoolteacher",
  },
  {
    key: "annapurna_betageri",
    fullName: "Annapurna Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "1901-12-05",
    dateOfDeath: "1980-06-30",
    city: "Belgaum",
    additionalNotes: "Married into the Deshpande family.",
  },
  {
    key: "ganpatrao_deshpande",
    fullName: "Ganpatrao Deshpande",
    familyName: "Deshpande",
    gender: "male",
    dateOfBirth: "1890-01-07",
    dateOfDeath: "1963-08-12",
    city: "Dharwad",
    occupation: "Advocate",
    education: "LL.B.",
  },
  {
    key: "yamuna_deshpande",
    fullName: "Yamuna Deshpande",
    familyName: "Deshpande",
    gender: "female",
    dateOfBirth: "1894-04-28",
    dateOfDeath: "1972-11-09",
    city: "Pune",
    additionalNotes: "Married her paternal cross-cousin Madhav Joshi.",
  },
  {
    key: "vasudev_deshpande",
    fullName: "Vasudev Deshpande",
    familyName: "Deshpande",
    gender: "male",
    dateOfBirth: "1899-07-15",
    dateOfDeath: "1974-02-02",
    city: "Belgaum",
    occupation: "Civil engineer",
    education: "B.E. Civil, College of Engineering Pune",
  },
  {
    key: "govind_kulkarni",
    fullName: "Govind Kulkarni",
    familyName: "Kulkarni",
    gender: "male",
    dateOfBirth: "1891-11-01",
    dateOfDeath: "1965-09-23",
    city: "Belgaum",
    occupation: "Professor of Mathematics",
    education: "M.A. Mathematics, Fergusson College",
  },
  {
    key: "parvati_kulkarni",
    fullName: "Parvati Kulkarni",
    familyName: "Kulkarni",
    gender: "female",
    dateOfBirth: "1896-03-20",
    dateOfDeath: "1975-05-14",
    city: "Dharwad",
    additionalNotes: "Married into the Deshpande family.",
  },
  {
    key: "radha_kulkarni",
    fullName: "Radha Kulkarni",
    familyName: "Kulkarni",
    gender: "female",
    dateOfBirth: "1900-08-08",
    dateOfDeath: "1978-12-01",
    city: "Hubli",
    additionalNotes: "Married her cross-cousin Ramchandra Nimbal.",
  },
  {
    key: "kaveribai_kulkarni",
    fullName: "Kaveribai Kulkarni",
    familyName: "Kulkarni",
    gender: "female",
    dateOfBirth: "1895-11-11",
    dateOfDeath: "1970-08-08",
    city: "Belgaum",
  },
  {
    key: "madhav_joshi",
    fullName: "Madhav Joshi",
    familyName: "Joshi",
    gender: "male",
    dateOfBirth: "1893-05-25",
    dateOfDeath: "1967-10-10",
    city: "Pune",
    occupation: "Ayurveda physician",
    education: "Sanskrit Pandit (Banaras Hindu University)",
  },
  {
    key: "kamala_joshi",
    fullName: "Kamala Joshi",
    familyName: "Joshi",
    gender: "female",
    dateOfBirth: "1897-02-19",
    dateOfDeath: "1979-07-07",
    city: "Dharwad",
    additionalNotes: "Married into the Betageri family.",
  },

  // ============================ G3 ============================
  {
    key: "dattatreya_betageri",
    fullName: "Dattatreya Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1917-04-22",
    dateOfDeath: "1992-01-30",
    city: "Bengaluru",
    occupation: "Physician",
    education: "M.B.B.S., Grant Medical College Bombay",
  },
  {
    key: "sharada_betageri",
    fullName: "Sharada Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "1921-09-14",
    dateOfDeath: "2001-06-19",
    city: "Mumbai",
    additionalNotes: "Married into the Deshpande family.",
  },
  {
    key: "manohar_betageri",
    fullName: "Manohar Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1925-11-30",
    dateOfDeath: "2010-03-12",
    city: "Hubli",
    occupation: "Chartered Accountant",
  },
  {
    key: "vishwanath_nimbal",
    fullName: "Vishwanath Nimbal",
    familyName: "Nimbal",
    gender: "male",
    dateOfBirth: "1920-07-05",
    dateOfDeath: "1995-12-01",
    city: "Bengaluru",
    occupation: "Indian Civil Service",
    education: "M.A. History, University of Bombay",
  },
  {
    key: "sushila_nimbal",
    fullName: "Sushila Nimbal",
    familyName: "Nimbal",
    gender: "female",
    dateOfBirth: "1924-02-19",
    dateOfDeath: "2005-04-22",
    city: "Pune",
    additionalNotes: "Married into the Joshi family.",
  },
  {
    key: "anant_nimbal",
    fullName: "Anant Nimbal",
    familyName: "Nimbal",
    gender: "male",
    dateOfBirth: "1928-10-10",
    dateOfDeath: "2015-08-18",
    city: "Mumbai",
    occupation: "Banker, Reserve Bank of India",
  },
  {
    key: "ashok_deshpande",
    fullName: "Ashok Deshpande",
    familyName: "Deshpande",
    gender: "male",
    dateOfBirth: "1918-06-03",
    dateOfDeath: "1998-09-09",
    city: "Mumbai",
    occupation: "Surgeon",
    education: "M.S., King Edward Memorial Hospital",
  },
  {
    key: "leela_deshpande",
    fullName: "Leela Deshpande",
    familyName: "Deshpande",
    gender: "female",
    dateOfBirth: "1922-03-28",
    dateOfDeath: "2012-11-15",
    city: "Hubli",
    additionalNotes: "Married into the Betageri family.",
  },
  {
    key: "prakash_joshi",
    fullName: "Prakash Joshi",
    familyName: "Joshi",
    gender: "male",
    dateOfBirth: "1919-12-01",
    dateOfDeath: "1999-05-07",
    city: "Pune",
    occupation: "Journalist, Kesari",
  },
  {
    key: "urmila_joshi",
    fullName: "Urmila Joshi",
    familyName: "Joshi",
    gender: "female",
    dateOfBirth: "1923-08-17",
    dateOfDeath: "2010-02-28",
    city: "Bengaluru",
    additionalNotes: "Married into the Betageri family.",
  },
  {
    key: "dinkar_joshi",
    fullName: "Dinkar Joshi",
    familyName: "Joshi",
    gender: "male",
    dateOfBirth: "1927-05-05",
    dateOfDeath: "2018-07-14",
    city: "Pune",
    occupation: "Mechanical engineer",
    education: "B.E., VJTI Bombay",
    additionalNotes: "Married his first cousin Nalini Betageri (his aunt Kamala's daughter).",
  },
  {
    key: "indumati_joshi",
    fullName: "Indumati Joshi",
    familyName: "Joshi",
    gender: "female",
    dateOfBirth: "1931-09-09",
    dateOfDeath: "2020-01-01",
    city: "Mumbai",
    additionalNotes: "Married into the Nimbal family.",
  },
  {
    key: "raghuveer_deshpande",
    fullName: "Raghuveer Deshpande",
    familyName: "Deshpande",
    gender: "male",
    dateOfBirth: "1924-01-15",
    dateOfDeath: "2008-10-04",
    city: "Mumbai",
    occupation: "Civil engineer, Tata Construction",
  },
  {
    key: "sudha_deshpande",
    fullName: "Sudha Deshpande",
    familyName: "Deshpande",
    gender: "female",
    dateOfBirth: "1928-04-24",
    dateOfDeath: "2014-12-11",
    city: "Bengaluru",
    additionalNotes: "Married into the Nimbal family.",
  },
  {
    key: "mukund_betageri",
    fullName: "Mukund Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1922-02-27",
    dateOfDeath: "2001-06-06",
    city: "Hubli",
    occupation: "Bank manager, State Bank of India",
  },
  {
    key: "nalini_betageri",
    fullName: "Nalini Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "1926-08-14",
    dateOfDeath: "2018-04-09",
    city: "Pune",
    additionalNotes: "Married her first cousin Dinkar Joshi.",
  },
  {
    key: "shailaja_kulkarni",
    fullName: "Shailaja Kulkarni",
    familyName: "Kulkarni",
    gender: "female",
    dateOfBirth: "1925-10-29",
    dateOfDeath: "2010-07-20",
    city: "Hubli",
    additionalNotes: "Married into the Betageri family.",
  },
  {
    key: "ravindra_kulkarni",
    fullName: "Ravindra Kulkarni",
    familyName: "Kulkarni",
    gender: "male",
    dateOfBirth: "1929-03-17",
    dateOfDeath: "2005-11-30",
    city: "Bengaluru",
    occupation: "Architect, town planning",
    additionalNotes: "Designed several Mysore-state municipal buildings; married late at 32.",
  },
  {
    key: "indravati_kulkarni",
    fullName: "Indravati Kulkarni",
    familyName: "Kulkarni",
    gender: "female",
    dateOfBirth: "1935-10-02",
    dateOfDeath: "2015-03-19",
    city: "Bengaluru",
    additionalNotes: "Married Ravindra Kulkarni in 1961.",
  },
  {
    key: "malati_kulkarni",
    fullName: "Malati Kulkarni",
    familyName: "Kulkarni",
    gender: "female",
    dateOfBirth: "1932-06-08",
    dateOfDeath: "2022-09-28",
    city: "Mumbai",
    additionalNotes: "Married into the Deshpande family.",
  },

  // ============================ G4 ============================
  {
    key: "arun_deshpande",
    fullName: "Arun Deshpande",
    familyName: "Deshpande",
    gender: "male",
    dateOfBirth: "1945-08-15",
    city: "Mumbai",
    occupation: "Chartered Accountant",
  },
  {
    key: "kavita_deshpande",
    fullName: "Kavita Deshpande",
    familyName: "Deshpande",
    gender: "female",
    dateOfBirth: "1948-11-11",
    city: "Pune",
    additionalNotes: "Married into the Joshi family.",
  },
  {
    key: "vijay_deshpande",
    fullName: "Vijay Deshpande",
    familyName: "Deshpande",
    gender: "male",
    dateOfBirth: "1952-02-29",
    city: "Mumbai",
    occupation: "Cardiothoracic surgeon",
    education: "M.Ch., AIIMS Delhi",
    additionalNotes: "Never married.",
  },
  {
    key: "mohan_nimbal",
    fullName: "Mohan Nimbal",
    familyName: "Nimbal",
    gender: "male",
    dateOfBirth: "1947-06-07",
    city: "Bengaluru",
    occupation: "IAS Officer (retd.)",
    education: "M.A. Economics, Delhi School of Economics",
  },
  {
    key: "rekha_nimbal",
    fullName: "Rekha Nimbal",
    familyName: "Nimbal",
    gender: "female",
    dateOfBirth: "1950-04-12",
    city: "Mumbai",
    additionalNotes: "Married into the Deshpande family.",
  },
  {
    key: "sanjay_nimbal",
    fullName: "Sanjay Nimbal",
    familyName: "Nimbal",
    gender: "male",
    dateOfBirth: "1954-12-19",
    city: "Bengaluru",
    occupation: "Professor of Physics, IISc",
    additionalNotes: "Never married.",
  },
  {
    key: "rajesh_betageri",
    fullName: "Rajesh Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1947-09-23",
    city: "Bengaluru",
    occupation: "General Manager, Canara Bank",
  },
  {
    key: "meena_betageri",
    fullName: "Meena Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "1951-05-05",
    city: "Dubai",
    additionalNotes: "Married into the Nimbal family.",
  },
  {
    key: "pradeep_joshi",
    fullName: "Pradeep Joshi",
    familyName: "Joshi",
    gender: "male",
    dateOfBirth: "1949-03-18",
    city: "Pune",
    occupation: "Editor, Loksatta",
  },
  {
    key: "anjali_joshi",
    fullName: "Anjali Joshi",
    familyName: "Joshi",
    gender: "female",
    dateOfBirth: "1952-07-04",
    city: "Pune",
    additionalNotes: "Married into the Betageri family.",
  },
  {
    key: "vikram_betageri",
    fullName: "Vikram Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1946-10-30",
    city: "Bengaluru",
    occupation: "Cardiologist",
    education: "D.M., Christian Medical College Vellore",
  },
  {
    key: "deepa_betageri",
    fullName: "Deepa Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "1950-01-12",
    city: "Bengaluru",
    additionalNotes: "Married into the Nimbal family.",
  },
  {
    key: "ashwin_joshi",
    fullName: "Ashwin Joshi",
    familyName: "Joshi",
    gender: "male",
    dateOfBirth: "1952-12-25",
    city: "Mumbai",
    occupation: "Structural engineer",
  },
  {
    key: "seema_joshi",
    fullName: "Seema Joshi",
    familyName: "Joshi",
    gender: "female",
    dateOfBirth: "1955-08-08",
    city: "Mumbai",
    additionalNotes: "Married into the Deshpande family.",
  },
  {
    key: "milind_betageri",
    fullName: "Milind Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1949-11-17",
    city: "Pune",
    occupation: "Professor of Economics, Gokhale Institute",
  },
  {
    key: "sushma_betageri",
    fullName: "Sushma Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "1953-06-22",
    city: "Pune",
    additionalNotes: "Married into the Joshi family.",
  },
  {
    key: "nilesh_nimbal",
    fullName: "Nilesh Nimbal",
    familyName: "Nimbal",
    gender: "male",
    dateOfBirth: "1955-02-14",
    city: "Dubai",
    occupation: "Investment banker",
  },
  {
    key: "anita_nimbal",
    fullName: "Anita Nimbal",
    familyName: "Nimbal",
    gender: "female",
    dateOfBirth: "1958-09-30",
    city: "Bengaluru",
    additionalNotes: "Married into the Betageri family.",
  },
  {
    key: "suresh_deshpande",
    fullName: "Suresh Deshpande",
    familyName: "Deshpande",
    gender: "male",
    dateOfBirth: "1950-07-07",
    city: "Mumbai",
    occupation: "Senior engineer, L&T",
  },
  {
    key: "mala_deshpande",
    fullName: "Mala Deshpande",
    familyName: "Deshpande",
    gender: "female",
    dateOfBirth: "1954-10-19",
    city: "Bengaluru",
    additionalNotes: "Married into the Betageri family.",
  },
  {
    key: "vandana_joshi",
    fullName: "Vandana Joshi",
    familyName: "Joshi",
    gender: "female",
    dateOfBirth: "1955-09-14",
    city: "Mumbai",
    additionalNotes: "Youngest of Prakash & Sushila's three children; married into the Deshpande family.",
  },
  {
    key: "ashwini_kulkarni",
    fullName: "Ashwini Kulkarni",
    familyName: "Kulkarni",
    gender: "female",
    dateOfBirth: "1962-04-21",
    city: "Bengaluru",
    additionalNotes: "Daughter of Ravindra & Indravati; married into the Nimbal family.",
  },
  {
    key: "hemant_kulkarni",
    fullName: "Hemant Kulkarni",
    familyName: "Kulkarni",
    gender: "male",
    dateOfBirth: "1965-11-08",
    city: "Bengaluru",
    occupation: "Classical vocalist and music teacher",
    additionalNotes: "Ravindra & Indravati's son; never married.",
  },

  // ============================ G5 ============================
  {
    key: "kunal_betageri",
    fullName: "Kunal Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1975-03-10",
    city: "Bengaluru",
    occupation: "Software engineer, Infosys",
    education: "B.E. CSE, RV College of Engineering",
  },
  {
    key: "tanvi_betageri",
    fullName: "Tanvi Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "1979-07-22",
    city: "Bengaluru",
    additionalNotes: "Married into the Deshpande family.",
  },
  {
    key: "rohit_joshi",
    fullName: "Rohit Joshi",
    familyName: "Joshi",
    gender: "male",
    dateOfBirth: "1976-11-05",
    city: "Pune",
    occupation: "Cardiologist",
    education: "D.M., AIIMS Delhi",
  },
  {
    key: "priya_joshi",
    fullName: "Priya Joshi",
    familyName: "Joshi",
    gender: "female",
    dateOfBirth: "1980-04-17",
    city: "Mumbai",
    occupation: "Product manager",
  },
  {
    key: "siddharth_nimbal",
    fullName: "Siddharth Nimbal",
    familyName: "Nimbal",
    gender: "male",
    dateOfBirth: "1980-09-09",
    city: "Dubai",
    occupation: "Investment banker, Goldman Sachs",
  },
  {
    key: "riya_nimbal",
    fullName: "Riya Nimbal",
    familyName: "Nimbal",
    gender: "female",
    dateOfBirth: "1984-12-03",
    city: "Bengaluru",
    additionalNotes: "Married into the Joshi family.",
  },
  {
    key: "aarti_betageri",
    fullName: "Aarti Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "1978-05-18",
    city: "Bengaluru",
    additionalNotes: "Married into the Deshpande family.",
  },
  {
    key: "shreya_nimbal",
    fullName: "Shreya Nimbal",
    familyName: "Nimbal",
    gender: "female",
    dateOfBirth: "1982-08-28",
    city: "Bengaluru",
    occupation: "Architect",
  },
  {
    key: "akshay_joshi",
    fullName: "Akshay Joshi",
    familyName: "Joshi",
    gender: "male",
    dateOfBirth: "1980-01-15",
    city: "Bengaluru",
    occupation: "Senior engineering manager, Google",
    education: "M.S. CS, Stanford University",
  },
  {
    key: "neha_joshi",
    fullName: "Neha Joshi",
    familyName: "Joshi",
    gender: "female",
    dateOfBirth: "1984-06-06",
    city: "London",
    occupation: "Research scientist, Imperial College",
  },
  {
    key: "varun_betageri",
    fullName: "Varun Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "1983-02-11",
    city: "Bengaluru",
    occupation: "Founder, fintech startup",
  },
  {
    key: "ishita_deshpande",
    fullName: "Ishita Deshpande",
    familyName: "Deshpande",
    gender: "female",
    dateOfBirth: "1985-10-30",
    city: "Bengaluru",
    additionalNotes: "Married into the Betageri family.",
  },
  {
    key: "karan_deshpande",
    fullName: "Karan Deshpande",
    familyName: "Deshpande",
    gender: "male",
    dateOfBirth: "1982-07-04",
    city: "Mumbai",
    occupation: "Product lead, Razorpay",
  },
  {
    key: "rohini_deshpande",
    fullName: "Rohini Deshpande",
    familyName: "Deshpande",
    gender: "female",
    dateOfBirth: "1981-06-17",
    city: "Mumbai",
    occupation: "Clinical psychologist",
    education: "Ph.D., TISS Mumbai",
    additionalNotes: "Married her maternal cross-cousin Rohit Joshi (her aunt Kavita's son).",
  },
  {
    key: "meera_nimbal",
    fullName: "Meera Nimbal",
    familyName: "Nimbal",
    gender: "female",
    dateOfBirth: "1987-03-25",
    city: "Bengaluru",
    occupation: "Hindustani vocalist",
    additionalNotes: "Sanjay Nimbal & Ashwini Kulkarni's only child.",
  },

  // ============================ G6 ============================
  {
    key: "aanya_betageri",
    fullName: "Aanya Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "2008-04-12",
    city: "Bengaluru",
    occupation: "Student, class 12",
  },
  {
    key: "vivaan_betageri",
    fullName: "Vivaan Betageri",
    familyName: "Betageri",
    gender: "male",
    dateOfBirth: "2012-07-25",
    city: "Bengaluru",
    occupation: "Student, class 8",
  },
  {
    key: "aryan_joshi",
    fullName: "Aryan Joshi",
    familyName: "Joshi",
    gender: "male",
    dateOfBirth: "2010-09-10",
    city: "Bengaluru",
    occupation: "Student, class 10",
  },
  {
    key: "ira_deshpande",
    fullName: "Ira Deshpande",
    familyName: "Deshpande",
    gender: "female",
    dateOfBirth: "2010-03-08",
    city: "Mumbai",
    occupation: "Student, class 10",
  },
  {
    key: "sarika_joshi",
    fullName: "Sarika Joshi",
    familyName: "Joshi",
    gender: "female",
    dateOfBirth: "2015-02-18",
    city: "Bengaluru",
    occupation: "Student, class 5",
  },
  {
    key: "zoya_betageri",
    fullName: "Zoya Betageri",
    familyName: "Betageri",
    gender: "female",
    dateOfBirth: "2012-11-09",
    city: "Bengaluru",
    occupation: "Student, class 8",
  },
  {
    key: "veer_nimbal",
    fullName: "Veer Nimbal",
    familyName: "Nimbal",
    gender: "male",
    dateOfBirth: "2013-06-30",
    city: "Dubai",
    occupation: "Student, class 7",
  },
  {
    key: "aarav_joshi",
    fullName: "Aarav Joshi",
    familyName: "Joshi",
    gender: "male",
    dateOfBirth: "2016-08-14",
    city: "Pune",
    occupation: "Student, class 4",
  },
];

/**
 * Couples. The first 5 are G1 founders; the rest are intermarriages.
 * Children listed by key. SIBLING_OF edges are derived automatically
 * for every pair of children within a couple.
 */
const couples: CoupleSpec[] = [
  // G1 founder couples
  {
    husband: "krishnarao_nimbal",
    wife: "gangabai_nimbal",
    marriageDate: "1888-05-10",
    children: ["ramchandra_nimbal", "tulsibai_nimbal"],
  },
  {
    husband: "vishnu_betageri",
    wife: "radhabai_betageri",
    marriageDate: "1889-06-22",
    children: ["keshav_betageri", "shivaram_betageri", "annapurna_betageri"],
  },
  {
    husband: "narayan_deshpande",
    wife: "laxmibai_deshpande",
    marriageDate: "1887-04-14",
    children: ["ganpatrao_deshpande", "yamuna_deshpande", "vasudev_deshpande"],
  },
  {
    husband: "shankar_kulkarni",
    wife: "saraswati_kulkarni",
    marriageDate: "1885-11-05",
    children: ["govind_kulkarni", "parvati_kulkarni", "radha_kulkarni"],
  },
  {
    husband: "balwant_joshi",
    wife: "indirabai_joshi",
    marriageDate: "1890-02-18",
    children: ["madhav_joshi", "kamala_joshi"],
  },

  // G2 intermarriages (cross-family)
  {
    husband: "keshav_betageri",
    wife: "tulsibai_nimbal",
    marriageDate: "1915-05-20",
    children: ["dattatreya_betageri", "sharada_betageri", "manohar_betageri"],
  },
  {
    husband: "ramchandra_nimbal",
    wife: "radha_kulkarni",
    marriageDate: "1918-06-10",
    children: ["vishwanath_nimbal", "sushila_nimbal", "anant_nimbal"],
  },
  {
    husband: "ganpatrao_deshpande",
    wife: "parvati_kulkarni",
    marriageDate: "1914-04-30",
    children: ["ashok_deshpande", "leela_deshpande"],
  },
  {
    husband: "madhav_joshi",
    wife: "yamuna_deshpande",
    marriageDate: "1916-03-12",
    children: ["prakash_joshi", "urmila_joshi", "dinkar_joshi", "indumati_joshi"],
  },
  {
    husband: "vasudev_deshpande",
    wife: "annapurna_betageri",
    marriageDate: "1922-11-08",
    children: ["raghuveer_deshpande", "sudha_deshpande"],
  },
  {
    husband: "shivaram_betageri",
    wife: "kamala_joshi",
    marriageDate: "1920-07-04",
    children: ["mukund_betageri", "nalini_betageri"],
  },
  {
    husband: "govind_kulkarni",
    wife: "kaveribai_kulkarni",
    marriageDate: "1919-05-05",
    children: ["shailaja_kulkarni", "ravindra_kulkarni", "malati_kulkarni"],
  },

  // G3 intermarriages
  {
    husband: "ashok_deshpande",
    wife: "sharada_betageri",
    marriageDate: "1943-06-14",
    children: ["arun_deshpande", "kavita_deshpande", "vijay_deshpande"],
  },
  {
    husband: "vishwanath_nimbal",
    wife: "sudha_deshpande",
    marriageDate: "1945-05-07",
    children: ["mohan_nimbal", "rekha_nimbal", "sanjay_nimbal"],
  },
  {
    husband: "mukund_betageri",
    wife: "leela_deshpande",
    marriageDate: "1946-02-19",
    children: ["rajesh_betageri", "meena_betageri"],
  },
  {
    husband: "prakash_joshi",
    wife: "sushila_nimbal",
    marriageDate: "1948-04-22",
    children: ["pradeep_joshi", "anjali_joshi", "vandana_joshi"],
  },
  {
    husband: "dattatreya_betageri",
    wife: "urmila_joshi",
    marriageDate: "1944-10-30",
    children: ["vikram_betageri", "deepa_betageri"],
  },
  {
    husband: "dinkar_joshi",
    wife: "nalini_betageri",
    marriageDate: "1950-01-15",
    children: ["ashwin_joshi", "seema_joshi"],
  },
  {
    husband: "manohar_betageri",
    wife: "shailaja_kulkarni",
    marriageDate: "1947-05-28",
    children: ["milind_betageri", "sushma_betageri"],
  },
  {
    husband: "anant_nimbal",
    wife: "indumati_joshi",
    marriageDate: "1953-11-07",
    children: ["nilesh_nimbal", "anita_nimbal"],
  },
  {
    husband: "raghuveer_deshpande",
    wife: "malati_kulkarni",
    marriageDate: "1948-08-09",
    children: ["suresh_deshpande", "mala_deshpande"],
  },

  // G4 intermarriages
  {
    husband: "vikram_betageri",
    wife: "mala_deshpande",
    marriageDate: "1972-12-04",
    children: ["kunal_betageri", "tanvi_betageri"],
  },
  {
    husband: "ashwin_joshi",
    wife: "kavita_deshpande",
    marriageDate: "1973-06-15",
    children: ["rohit_joshi", "priya_joshi"],
  },
  {
    husband: "nilesh_nimbal",
    wife: "meena_betageri",
    marriageDate: "1975-05-12",
    children: ["siddharth_nimbal", "riya_nimbal"],
  },
  {
    husband: "milind_betageri",
    wife: "anjali_joshi",
    marriageDate: "1974-11-27",
    children: ["aarti_betageri"],
  },
  {
    husband: "mohan_nimbal",
    wife: "deepa_betageri",
    marriageDate: "1975-02-09",
    children: ["shreya_nimbal"],
  },
  {
    husband: "pradeep_joshi",
    wife: "sushma_betageri",
    marriageDate: "1977-08-22",
    children: ["akshay_joshi", "neha_joshi"],
  },
  {
    husband: "rajesh_betageri",
    wife: "anita_nimbal",
    marriageDate: "1978-03-14",
    children: ["varun_betageri"],
  },
  {
    husband: "arun_deshpande",
    wife: "rekha_nimbal",
    marriageDate: "1976-09-20",
    children: ["ishita_deshpande"],
  },
  {
    husband: "suresh_deshpande",
    wife: "seema_joshi",
    marriageDate: "1980-11-11",
    children: ["karan_deshpande"],
  },

  // Late G3 / G4 additions that create same-person-multiple-roles scenarios
  //
  // Ravindra Kulkarni marries late and has two children. Their descendants
  // reconnect the Kulkarni blood-line directly to the Nimbal tree (where
  // Kulkarni blood already flowed via Radha and Parvati at G2).
  {
    husband: "ravindra_kulkarni",
    wife: "indravati_kulkarni",
    marriageDate: "1961-05-14",
    children: ["ashwini_kulkarni", "hemant_kulkarni"],
  },
  // Sanjay Nimbal marries Ashwini Kulkarni (his second cousin: Sanjay's paternal
  // grandmother Radha Kulkarni and Ashwini's paternal grandfather Govind Kulkarni
  // were siblings). Creates a reinforcing Nimbal<->Kulkarni loop at G4.
  {
    husband: "sanjay_nimbal",
    wife: "ashwini_kulkarni",
    marriageDate: "1985-02-03",
    children: ["meera_nimbal"],
  },
  // Vijay Deshpande (surgeon) marries Vandana Joshi (the added third c16 child).
  // Their daughter Rohini will later marry her maternal cousin Rohit Joshi.
  {
    husband: "vijay_deshpande",
    wife: "vandana_joshi",
    marriageDate: "1978-12-16",
    children: ["rohini_deshpande"],
  },

  // G5 intermarriages
  {
    husband: "kunal_betageri",
    wife: "ishita_deshpande",
    marriageDate: "2005-12-02",
    children: ["aanya_betageri", "vivaan_betageri"],
  },
  {
    husband: "akshay_joshi",
    wife: "riya_nimbal",
    marriageDate: "2008-06-27",
    children: ["aryan_joshi", "sarika_joshi"],
  },
  {
    husband: "karan_deshpande",
    wife: "aarti_betageri",
    marriageDate: "2006-02-11",
    children: ["ira_deshpande"],
  },
  // Varun Betageri x Shreya Nimbal: Varun's mother Anita and Shreya's father
  // Mohan are themselves first cousins (their fathers Anant and Vishwanath are
  // brothers), so Varun and Shreya are second cousins. Their G6 child Zoya is
  // triply linked to the Nimbal line through both parents and grandparents.
  {
    husband: "varun_betageri",
    wife: "shreya_nimbal",
    marriageDate: "2009-10-25",
    children: ["zoya_betageri"],
  },
  // Siddharth Nimbal x Priya Joshi: links Nimbal+Betageri (Siddharth's side) to
  // Joshi+Deshpande (Priya's side) yet again.
  {
    husband: "siddharth_nimbal",
    wife: "priya_joshi",
    marriageDate: "2010-11-06",
    children: ["veer_nimbal"],
  },
  // Rohit Joshi x Rohini Deshpande: traditional maternal cross-cousin marriage.
  // Rohit's mother Kavita is Rohini's father Vijay's sister -> Vijay Deshpande
  // becomes both Rohit's MATERNAL UNCLE and his FATHER-IN-LAW simultaneously.
  // Similarly Kavita is both Rohini's AUNT and MOTHER-IN-LAW.
  {
    husband: "rohit_joshi",
    wife: "rohini_deshpande",
    marriageDate: "2012-04-28",
    children: ["aarav_joshi"],
  },
];

/**
 * Cross-family sibling edges that are not captured by shared parents in
 * `couples`. At G1, some founders have siblings in *other* families via
 * the unrecorded founder generation.
 */
const extraSiblingPairs: Array<[string, string]> = [
  ["gangabai_nimbal", "shankar_kulkarni"],
  ["laxmibai_deshpande", "balwant_joshi"],
];

async function run(driver: Driver): Promise<void> {
  const session = DATABASE ? driver.session({ database: DATABASE }) : driver.session();
  try {
    console.log("Wiping existing Person/Family data...");
    await session.run("MATCH (n) WHERE n:Person OR n:Family DETACH DELETE n");

    console.log(`Creating ${persons.length} persons across 5 families...`);
    const now = new Date().toISOString();
    const personRows = persons.map((p) => ({
      id: randomUUID(),
      key: p.key,
      fullName: p.fullName,
      familyName: p.familyName,
      dateOfBirth: p.dateOfBirth ?? null,
      dateOfDeath: p.dateOfDeath ?? null,
      gender: p.gender,
      city: p.city ?? null,
      occupation: p.occupation ?? null,
      education: p.education ?? null,
      additionalNotes: p.additionalNotes ?? null,
    }));

    const keyToId = new Map<string, string>(
      personRows.map((r) => [r.key, r.id])
    );

    await session.run(
      `
      UNWIND $rows AS row
      MERGE (f:Family {name: row.familyName})
        ON CREATE SET f.id = randomUUID()
      CREATE (p:Person {
        id: row.id,
        fullName: row.fullName,
        normalizedName: toLower(row.fullName),
        familyName: row.familyName,
        dateOfBirth: row.dateOfBirth,
        dateOfDeath: row.dateOfDeath,
        gender: row.gender,
        city: row.city,
        occupation: row.occupation,
        education: row.education,
        phone: null,
        email: null,
        linkedinUrl: null,
        additionalNotes: row.additionalNotes,
        status: 'verified',
        createdAt: $now,
        updatedAt: $now
      })
      CREATE (p)-[:BELONGS_TO_FAMILY]->(f)
      `,
      { rows: personRows, now }
    );

    const spouseRows: Array<{ hid: string; wid: string; marriageDate: string | null }> = [];
    const fatherEdges: Array<{ parentId: string; childId: string }> = [];
    const motherEdges: Array<{ parentId: string; childId: string }> = [];
    const siblingEdges: Array<{ a: string; b: string }> = [];

    for (const c of couples) {
      const hid = keyToId.get(c.husband);
      const wid = keyToId.get(c.wife);
      if (!hid || !wid) {
        throw new Error(`Unknown spouse key in couple: ${c.husband} + ${c.wife}`);
      }
      spouseRows.push({ hid, wid, marriageDate: c.marriageDate ?? null });

      const childIds = c.children.map((key) => {
        const id = keyToId.get(key);
        if (!id) throw new Error(`Unknown child key: ${key}`);
        return id;
      });

      for (const cid of childIds) {
        fatherEdges.push({ parentId: hid, childId: cid });
        motherEdges.push({ parentId: wid, childId: cid });
      }

      for (let i = 0; i < childIds.length; i++) {
        for (let j = i + 1; j < childIds.length; j++) {
          siblingEdges.push({ a: childIds[i], b: childIds[j] });
        }
      }
    }

    for (const [a, b] of extraSiblingPairs) {
      const ida = keyToId.get(a);
      const idb = keyToId.get(b);
      if (!ida || !idb) throw new Error(`Unknown sibling key: ${a} / ${b}`);
      siblingEdges.push({ a: ida, b: idb });
    }

    console.log(`Creating ${spouseRows.length} marriage edges...`);
    await session.run(
      `
      UNWIND $rows AS row
      MATCH (h:Person {id: row.hid}), (w:Person {id: row.wid})
      MERGE (h)-[r:SPOUSE_OF]->(w)
      FOREACH (_ IN CASE WHEN row.marriageDate IS NOT NULL THEN [1] ELSE [] END |
        SET r.marriageDate = row.marriageDate
      )
      `,
      { rows: spouseRows }
    );

    console.log(`Creating ${fatherEdges.length} FATHER_OF edges...`);
    await session.run(
      `
      UNWIND $rows AS row
      MATCH (p:Person {id: row.parentId}), (c:Person {id: row.childId})
      MERGE (p)-[:FATHER_OF]->(c)
      `,
      { rows: fatherEdges }
    );

    console.log(`Creating ${motherEdges.length} MOTHER_OF edges...`);
    await session.run(
      `
      UNWIND $rows AS row
      MATCH (p:Person {id: row.parentId}), (c:Person {id: row.childId})
      MERGE (p)-[:MOTHER_OF]->(c)
      `,
      { rows: motherEdges }
    );

    console.log(`Creating ${siblingEdges.length} SIBLING_OF edges...`);
    await session.run(
      `
      UNWIND $rows AS row
      MATCH (a:Person {id: row.a}), (b:Person {id: row.b})
      MERGE (a)-[:SIBLING_OF]->(b)
      `,
      { rows: siblingEdges }
    );

    const summary = await session.run(`
      MATCH (f:Family)
      OPTIONAL MATCH (p:Person)-[:BELONGS_TO_FAMILY]->(f)
      RETURN f.name AS family, count(p) AS members
      ORDER BY family
    `);
    console.log("\nFamily summary:");
    for (const rec of summary.records) {
      const members = rec.get("members");
      const count = typeof members === "object" && members && "toNumber" in members
        ? (members as { toNumber(): number }).toNumber()
        : (members as number);
      console.log(`  ${rec.get("family")}: ${count} members`);
    }

    const totals = await session.run(`
      MATCH ()-[r]->() WHERE type(r) IN ['FATHER_OF','MOTHER_OF','SPOUSE_OF','SIBLING_OF']
      RETURN type(r) AS t, count(r) AS n
    `);
    console.log("\nEdge counts:");
    for (const rec of totals.records) {
      const n = rec.get("n");
      const count = typeof n === "object" && n && "toNumber" in n
        ? (n as { toNumber(): number }).toNumber()
        : (n as number);
      console.log(`  ${rec.get("t")}: ${count}`);
    }

    console.log("\nSeed complete.");
  } finally {
    await session.close();
  }
}

async function main(): Promise<void> {
  const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD), {
    maxConnectionPoolSize: 10,
    connectionAcquisitionTimeout: 15000,
  });
  try {
    await run(driver);
  } finally {
    await driver.close();
  }
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
