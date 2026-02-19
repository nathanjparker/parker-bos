"use client";

import { useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import AppShell from "@/components/AppShell";
import { db, getFirebaseAuth } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Hardcoded Airtable data — 13 jobs + 275 companies + 582 contacts + 28 jurisdictions + 8 employees
// ---------------------------------------------------------------------------

type RawContact = {
  firstName: string;
  lastName: string;
  companyName?: string; // matches AIRTABLE_COMPANIES name
  title?: string;
  email?: string;
  phone?: string;
};

const AIRTABLE_CONTACTS: RawContact[] = [
  { firstName: "Joel", lastName: "Rasmussen", companyName: "Tacoma", title: "Plan Reviewer", email: "JRasmussen@cityoftacoma.org", phone: "(253) 363-2241" },
  { firstName: "Ray", lastName: "Allshouse", companyName: "Shoreline", title: "Plan Reviewer", email: "rallshouse@shorelinewa.gov", phone: "(206) 801-2541" },
  { firstName: "Angelique", lastName: "Hockett", companyName: "Seattle Public Utilities", title: "Senior Environmental Compliance Inspector (FOG)", email: "angelique.hockett@seattle.gov", phone: "(206) 512-7496" },
  { firstName: "Renee", lastName: "Tautua", companyName: "Seattle King County (Reviewers)", title: "Permit Technician", email: "rtautua@kingcounty.gov", phone: "(206) 477-3206" },
  { firstName: "Alan", lastName: "Czarnecki", companyName: "Seattle King County (Reviewers)", title: "Plan Reviewer", email: "aczarnecki@kingcounty.gov", phone: "(206) 263-4183" },
  { firstName: "Dave", lastName: "Price", companyName: "Seattle King County (Reviewers)", title: "Plan Reviewer", email: "planreviewinfo@kingcounty.gov", phone: "(206) 848-0906" },
  { firstName: "Eric", lastName: "Gilbreath", companyName: "Seattle King County (Reviewers)", title: "Senior Inspector", email: "eric.gilbreath@kingcounty.gov", phone: "(206) 263-9547" },
  { firstName: "Ian", lastName: "McLaughlin", companyName: "Seattle King County (Reviewers)", title: "Senior Inspector", email: "Ian.McLaughlin@kingcounty.gov", phone: "(206) 263-1233" },
  { firstName: "Mike", lastName: "Ballou", companyName: "Seattle King County (Reviewers)", title: "Plan Reviewer", email: "michael.ballou@kingcounty.gov", phone: "(206) 477-8636" },
  { firstName: "Patty", lastName: "Sjolin", companyName: "Seattle King County (Reviewers)", title: "Plan Reviewer", email: "psjolin@kingcounty.gov", phone: "(206) 263-6877" },
  { firstName: "Sandy", lastName: "Harpreet", companyName: "Seattle King County (Reviewers)", title: "Plan Reviewer", email: "Harpreet.Sandhu@kingcounty.gov", phone: "(206) 477-8638" },
  { firstName: "Steve", lastName: "Hart", companyName: "Seattle King County (Reviewers)", title: "Senior Inspector", email: "Steven.Hart@kingcounty.gov", phone: "(206) 263-9548" },
  { firstName: "Todd", lastName: "Bradbury", companyName: "Seattle King County (Reviewers)", title: "Plan Reviewer", email: "tbradbury@kingcounty.gov", phone: "(206) 263-1944" },
  { firstName: "Carlos", lastName: "Barrientes", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "cabarrientes@kingcounty.gov", phone: "(206) 263-2698" },
  { firstName: "Dan", lastName: "Osborne", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "dosborne@kingcounty.gov", phone: "(206) 477-6069" },
  { firstName: "Dan", lastName: "Roberson", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "dan.roberson@kingcounty.gov", phone: "(206) 477-8636" },
  { firstName: "David", lastName: "Cheeseman", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "dcheeseman@kingcounty.gov", phone: "(206) 477-0891" },
  { firstName: "Doug", lastName: "Harris", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "doharris@kingcounty.gov", phone: "(206) 263-6850" },
  { firstName: "Eric", lastName: "Gilbreth", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "Eric.Gilbreath@kingcounty.gov", phone: "(206) 263-9547" },
  { firstName: "Larry", lastName: "Callahan", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "larry.callahan@kingcounty.gov", phone: "(206) 263-8502" },
  { firstName: "Nathan", lastName: "Isaacson", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "naisaacson@kingcounty.gov", phone: "(206) 477-5586" },
  { firstName: "Randall", lastName: "Bray", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "randall.bray@kingcounty.gov", phone: "(206) 263-8514" },
  { firstName: "Rick", lastName: "Lewis", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "rick.lewis@kingcounty.gov", phone: "(206) 263-8519" },
  { firstName: "Scott", lastName: "Entsminger", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "sentsminger@kingcounty.gov", phone: "(206) 477-9204" },
  { firstName: "Susan", lastName: "", companyName: "Seattle King County (Inspectors)", phone: "(206) 263-9560" },
  { firstName: "Tom", lastName: "Haynes", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "thomas.haynes@kingcounty.gov", phone: "(206) 263-8506" },
  { firstName: "Tracy", lastName: "Belvill", companyName: "Seattle King County (Inspectors)", title: "Inspector", email: "tracy.belvill@kingcounty.gov", phone: "(206) 263-8510" },
  { firstName: "Brian", lastName: "Hippie", title: "Inspector", email: "brian.hippe@seattle.gov", phone: "(206) 684-5835" },
  { firstName: "Steve", lastName: "Frazier", title: "Plan Reviewer", email: "Steve.Frazier@seattle.gov", phone: "(206) 684-8459" },
  { firstName: "Michael George", lastName: "", companyName: "Renton", title: "Plan Reviewer", phone: "(206) 999-1824" },
  { firstName: "Scott", lastName: "Mitchell", companyName: "Renton", title: "Plan Reviewer", phone: "(425) 902-7572" },
  { firstName: "Bruce", lastName: "Brown", companyName: "Redmond", title: "Plan Reviewer", email: "bcbrown@redmond.gov", phone: "(425) 556-2323" },
  { firstName: "Teri", lastName: "Tupper", companyName: "Redmond", title: "Plan Reviewer", email: "ttupper@redmond.gov", phone: "(425) 556-2432" },
  { firstName: "Andreea", lastName: "Badiu", companyName: "Mill Creek", title: "Permit Technician", email: "andreea.badiu@millcreekwa.gov", phone: "(425) 551-7254" },
  { firstName: "Bobby", lastName: "Thomas", companyName: "Mill Creek", title: "Inspector", email: "bthomas@safebuilt.com", phone: "(206) 514-1883" },
  { firstName: "Mike", lastName: "Kolakowski", companyName: "Mill Creek", title: "Inspector", phone: "(425) 745-1891" },
  { firstName: "Deb", lastName: "Yankeh", companyName: "Maple Valley" },
  { firstName: "Justin", lastName: "Hauley", companyName: "Kirkland", title: "Inspector", phone: "(425) 229-3549" },
  { firstName: "Karl", lastName: "Fitterer" },
  { firstName: "Melanie", lastName: "Young", companyName: "Duvall", title: "Permit Technician", email: "permit.technician@duvallwa.gov", phone: "(425) 939-8041" },
  { firstName: "Ryan", lastName: "Niemi", companyName: "Des Moines", title: "Plan Reviewer", email: "rniemi@desmoineswa.gov" },
  { firstName: "Kelly Thompson", lastName: "", companyName: "Covington", title: "Permit Technician", email: "kthompson@covingtonwa.gov" },
  { firstName: "Bob", lastName: "Heavey", companyName: "Bellevue", title: "Plan Reviewer", email: "rheavey@bellevuewa.gov", phone: "(425) 452-6877" },
  { firstName: "Mark", lastName: "Muld", companyName: "Bellevue", title: "Plan Reviewer", email: "mmuld@bellevuewa.gov", phone: "(425) 452-4388" },
  { firstName: "Aaron", lastName: "Johnson", title: "Estimator", email: "aaron.johnson@abbottconstruction.com", phone: "(907) 230-3930" },
  { firstName: "Alex Bozhko", lastName: "", title: "Site Supervisor", email: "Alex.Bozhko@deacon.com", phone: "(206) 247-3574" },
  { firstName: "Andy", lastName: "Simutis", title: "Owner", email: "ANDY@SUPERGMEDIA.COM", phone: "(206) 369-8673" },
  { firstName: "Aryssa", lastName: "Brantner", title: "Office Admin", email: "aryssa@metisconstructioninc.com", phone: "(206) 605-2496" },
  { firstName: "Bailey", lastName: "White", title: "Project Manager", email: "bailey@metisconstructioninc.com", phone: "(206) 747-7792" },
  { firstName: "Bobby", lastName: "Harriman", title: "Owner", email: "bobby@littlemountainmontessori.com", phone: "(206) 353-8266" },
  { firstName: "Carl", lastName: "Lindstrom", email: "carl.lindstrom10@comcast.net", phone: "(206) 948-1217" },
  { firstName: "Chris", lastName: "Piotrowski", title: "Estimator", email: "bids@cpmnw.com", phone: "360.863.6708 x118" },
  { firstName: "Danica", lastName: "" },
  { firstName: "David", lastName: "Delfs", title: "Project Manager", email: "davidd@dovetailgc.com", phone: "(206) 383-3474" },
  { firstName: "Deborah", lastName: "", phone: "(206) 477-8146" },
  { firstName: "Dennis", lastName: "Altima", title: "Estimator", email: "Dennis@gencap.com" },
  { firstName: "Eddie", lastName: "Gulberg" },
  { firstName: "Eddie Gulberg", lastName: "", title: "Owner", phone: "(206) 948-7226" },
  { firstName: "Er", lastName: "" },
  { firstName: "Guy", lastName: "Pennington", title: "Estimator", email: "gpennington@axiomdesignbuild.com", phone: "(206) 637-1701" },
  { firstName: "Hiroshi", lastName: "Matsubara", email: "hiroshi@gmstudio.us" },
  { firstName: "James", lastName: "Croley", email: "scribblmaster@hotmail.com", phone: "(206) 661-5563" },
  { firstName: "Jeff", lastName: "Baker", title: "Owner", email: "Jebaker611@gmail.com", phone: "(425) 478-0122" },
  { firstName: "Joe", lastName: "Kilbourne", title: "Site Supervisor", email: "jkpbass@gmail.com", phone: "(206) 383-1553" },
  { firstName: "John", lastName: "Bankson", title: "Owner", email: "john@nwffllc.com", phone: "(206) 914-7074" },
  { firstName: "Josh", lastName: "Voigt", title: "Site Supervisor", email: "joshv@metisconstructioninc.com", phone: "(206) 527-5885" },
  { firstName: "Joshua Westfall", lastName: "", title: "Site Supervisor", email: "iamjoshuawestfall@gmail.com", phone: "(206) 856-5860" },
  { firstName: "Justin Suede", lastName: "", phone: "(206) 457-4080" },
  { firstName: "Kelly", lastName: "" },
  { firstName: "Kelly", lastName: "Gilliam", title: "Office Admin", email: "kellyg@dovetailgc.com", phone: "(206) 353-9313" },
  { firstName: "Kevin", lastName: "Proefrock", title: "Site Supervisor", phone: "(206) 293-4119" },
  { firstName: "Kyle", lastName: "Vaughn", title: "Project Manager", email: "kvaughn@axiomdesignbuild.com", phone: "(206) 519-4975" },
  { firstName: "LeeAnn", lastName: "", title: "Estimator", email: "lford@gray.com", phone: "(714) 491-1317" },
  { firstName: "Madison Chapman", lastName: "", title: "Office Admin", email: "madison.chapman@walefins.com", phone: "(702) 721-1941" },
  { firstName: "Mark", lastName: "Cox", title: "Senior Project Executive", email: "Markc@gcempire.com", phone: "(469) 325-4446" },
  { firstName: "Matt Matt", lastName: "Wilcox", title: "Project Manager", email: "mwilcox@wilcoxconstruction.com", phone: "(206) 530-1342" },
  { firstName: "Max", lastName: "Genereaux", title: "Owner", email: "max@sunsettavern.com", phone: "(206) 228-6299" },
  { firstName: "Michael", lastName: "Halls", title: "Foreman", email: "michaelh@dovetailgc.com", phone: "(206) 354-0198" },
  { firstName: "Michelle Scapa", lastName: "", email: "michelles@woodmanconstruction.com" },
  { firstName: "Molly", lastName: "Lanzinger" },
  { firstName: "Nate", lastName: "Simpson", title: "Project Manager", email: "nathan@blackrockind.com", phone: "(253) 347-9586" },
  { firstName: "Neil", lastName: "Burton", title: "Estimator", email: "neil.burton@deacon.com", phone: "(425) 284-4000 ex 4093" },
  { firstName: "Nick", lastName: "Clifford", title: "Project Manager", email: "njcliff@comcast.net", phone: "(425) 736-4269" },
  { firstName: "Paul Sommer", lastName: "", email: "paul@esrhospitality.com", phone: "(206) 251-2657" },
  { firstName: "Poncharee", lastName: "Kounpungchart", title: "Project Manager", email: "pk@metisconstructioninc.com", phone: "(206) 453-8189" },
  { firstName: "Rick", lastName: "Hendrickson", title: "Site Supervisor", email: "rickh@woodmanconstruction.com", phone: "(206) 510-3160" },
  { firstName: "Robert", lastName: "Michaels", email: "rmichaels@fradkin.co", phone: "(703) 595-7379" },
  { firstName: "Sarah", lastName: "Sarah Narrow", title: "Project Manager", email: "sarahn@dovetailgc.com" },
  { firstName: "Savannah", lastName: "Anderson", email: "andersandco@outlook.com", phone: "(360) 513-2828" },
  { firstName: "Scott", lastName: "Siren", phone: "(206) 355-6296" },
  { firstName: "Shane", lastName: "Robinson", email: "shanecrobinson@gmail.com", phone: "(206) 465-4740" },
  { firstName: "Shawn", lastName: "Stone", title: "Site Supervisor", email: "shawns@woodmanconstruction.com", phone: "(509) 385-5544" },
  { firstName: "Shawn", lastName: "O'Donell", email: "shawnjr@shawnodonnells.com", phone: "(425) 501-1019" },
  { firstName: "Shawn", lastName: "O'Donell Jr", email: "shawnjr@shawnodonnells.com", phone: "(425) 501-1019" },
  { firstName: "Steve", lastName: "Jones", title: "Sales Rep", email: "steve@sdajnw.com" },
  { firstName: "Tina", lastName: "", title: "Office Admin", phone: "(253) 876-1923" },
  { firstName: "Dave", lastName: "", companyName: "A+ Backflow", phone: "(425) 830-3749" },
  { firstName: "Andy", lastName: "Sprague", companyName: "Abbott Construction", title: "Office Admin", phone: "(206) 467-8500" },
  { firstName: "Brannon", lastName: "Shalley", companyName: "Abbott Construction", title: "Project Manager" },
  { firstName: "Paul", lastName: "Churchill", companyName: "Abbott Construction", title: "Project Manager" },
  { firstName: "Alex", lastName: "Abossein", companyName: "Abossein Engineering", title: "Owner", email: "alex_abossein@abossein.com" },
  { firstName: "Dennis", lastName: "Grovenburg", companyName: "Abossein Engineering", title: "Engineer", email: "dennis_grovenburg@abossein.com", phone: "4254629441 EXT 1002" },
  { firstName: "Brian", lastName: "Egan", companyName: "ACG", title: "Project Manager", email: "brian@acgbuilds.com" },
  { firstName: "Chad", lastName: "Quilici", companyName: "ACG", title: "Owner", email: "chad@acgbuilds.com" },
  { firstName: "Chris", lastName: "Black", companyName: "ACG", title: "Estimator", email: "chris@metisconstructioninc.com", phone: "(540) 383-0264" },
  { firstName: "Darcy", lastName: "Tsujikawa", companyName: "ACG", title: "Estimator", email: "darcy@alegisconstruction.com", phone: "2067905875" },
  { firstName: "Erik", lastName: "Aasen", companyName: "ACG", title: "Site Supervisor", email: "erik@acgbuilds.com", phone: "(206) 409-6956" },
  { firstName: "Jennifer", lastName: "Clark", companyName: "ACG", title: "Accounting", email: "jc@acgbuilds.com", phone: "(206) 465-7973" },
  { firstName: "Jon", lastName: "Chase", companyName: "ACG", title: "Site Supervisor", email: "Jon@acgbuilds.com", phone: "(206) 384-1130" },
  { firstName: "Travis", lastName: "Dixey", companyName: "ACG", title: "Estimator", email: "travis@acgbuilds.com", phone: "(425) 444-5660" },
  { firstName: "Andrew", lastName: "Williamson", companyName: "Acme & PF Supply", title: "Will Call Lead / Inside Sales", email: "andreww@acmetool.com", phone: "(206) 957-8200" },
  { firstName: "Ryan", lastName: "Rustrum", companyName: "Acme & PF Supply", title: "Accounts Receivable", email: "ryanr@acmetool.com", phone: "(503) 444-5261" },
  { firstName: "Brandon", lastName: "Wriggle", companyName: "AEG Presents", email: "bwriggle@aegpresents.com", phone: "(253) 426-5094" },
  { firstName: "Demesio", lastName: "Cedeno", companyName: "Alegis", title: "Project Manager", email: "demesio.cedeno@alegisconstruction.com" },
  { firstName: "Graham", lastName: "Barker", companyName: "Alegis", title: "Project Manager", email: "graham.barker@alegisconstruction.com", phone: "(253) 677-2329" },
  { firstName: "Jim", lastName: "Silvis", companyName: "Alegis", title: "Project Manager", email: "jim.silvis@alegisconstruction.com" },
  { firstName: "Mike", lastName: "Price", companyName: "Alegis", title: "Project Manager", email: "mike.price@alegisconstruction.com" },
  { firstName: "Tyler", lastName: "Milne", companyName: "Alegis", title: "Project Manager", email: "tyler.milne@alegisconstruction.com" },
  { firstName: "Chris", lastName: "Hanson", companyName: "Allumia", title: "Director of Customer Success", email: "chanson@allumia.com", phone: "(206) 317-4478" },
  { firstName: "Sierra", lastName: "Graham", companyName: "Always Downtown / Promondo", title: "Project Manager", email: "sierra@alwaysdowntown.com", phone: "(206) 334-2285" },
  { firstName: "Sara", lastName: "Monroe", companyName: "Amazon", title: "Senior Property Associate", email: "monnsara@amazon.com" },
  { firstName: "Trisha", lastName: "Ackley", companyName: "Amazon", title: "Senior Property Associate", email: "xtrackle@amazon.com", phone: "(425) 444-7954" },
  { firstName: "Ben", lastName: "Foster", companyName: "American Leak Detection", email: "ben@aldnw.com", phone: "(425) 559-3486" },
  { firstName: "Ron", lastName: "Kazemian", companyName: "American Rooter Sewer and Drain", title: "Owner", email: "rrron3459@gmail.com", phone: "(206) 375-2222" },
  { firstName: "Bob", lastName: "Andrews", companyName: "Andrews Group (The)", title: "Office", email: "boba@theandrewsgroup.net", phone: "(360) 852-1230" },
  { firstName: "Julia", lastName: "Currier", companyName: "Andrews Group (The)", title: "Estimator", email: "juliaC@theandrewsgroup.net", phone: "(360) 984-5460" },
  { firstName: "Wayne", lastName: "Kortlever", companyName: "Andrews Group (The)", title: "Site Supervisor", email: "waynek@theandrewsgroup.net" },
  { firstName: "Sean", lastName: "Ryan", companyName: "Anytime CR (ACR)", title: "Project Manager", email: "sean@anytimecr.com", phone: "(206) 714-7986" },
  { firstName: "Tim", lastName: "Wistrom", companyName: "Atlas Construction", title: "Owner", email: "timw@atlasconstructionspecialties.com", phone: "(206) 553-9897" },
  { firstName: "Justin", lastName: "Seem", companyName: "Avara Construction", title: "Estimator", email: "jseem@avaraconstruction.com", phone: "(425) 830-9001" },
  { firstName: "Kraig", lastName: "Wilhelmsen", companyName: "Avid Build", title: "Project Manager", email: "kraig@avidbuild.com", phone: "(206) 715-8860" },
  { firstName: "Kiley", lastName: "Perkins", companyName: "Axiom", title: "Project Manager", email: "kperkins@axiomdesignbuild.com", phone: "(206) 790-0586" },
  { firstName: "Max", lastName: "Anderson-Portnoy", companyName: "Axiom", title: "Project Manager", email: "mportnoy@axiomdesignbuild.com", phone: "2068196755" },
  { firstName: "Shanna", lastName: "Ali", companyName: "Axiom", title: "Project Manager", email: "sali@axiomdesignbuild.com", phone: "(206) 283-9535" },
  { firstName: "Skyler", lastName: "", companyName: "Axiom", title: "Project Manager", email: "SLonganecker@axiomdesignbuild.com", phone: "-206-399-4866" },
  { firstName: "Warren", lastName: "Woodward", companyName: "Axiom", title: "Project Manager", email: "wwoodward@axiomdesignbuild.com", phone: "(206) 283-2082" },
  { firstName: "Kariss Sutton", lastName: "", companyName: "Backflows Northwest", title: "Accounting", email: "office@backflowsnorthwest.com", phone: "(425) 277-2888" },
  { firstName: "Danny", lastName: "Baird", companyName: "Baird Designs", title: "Owner", email: "bairddesigns@gmail.com", phone: "(206) 669-5159" },
  { firstName: "Kyle", lastName: "McGee", companyName: "BCI National Construction and Facilities", title: "Estimator", email: "kmcgee@bcinational.com" },
  { firstName: "Joel", lastName: "Beauchamp", companyName: "Beauchamp", title: "Owner", email: "joelchamp@msn.com", phone: "4253271126" },
  { firstName: "Mark", lastName: "Stern", companyName: "Big Picture", title: "Owner", email: "marksbigpicture@yahoo.com", phone: "(425) 985-1804" },
  { firstName: "Benjamin", lastName: "Anderson", companyName: "BKB", title: "Owner", email: "benjamin.m.anderson@gmail.com", phone: "(206) 679-3370" },
  { firstName: "Darrell", lastName: "Johnson", companyName: "BKB", title: "Project Manager", email: "dj@thedesmoinestheater.com" },
  { firstName: "Glee", lastName: "Nelson", companyName: "BKB", title: "Office Admin", email: "gleemnelson@gmail.com", phone: "(425) 218-1855" },
  { firstName: "Joshua", lastName: "Westfall", companyName: "BKB", title: "Site Supervisor", email: "iamjoshuawestfall@gmail.com", phone: "(206) 856-5860" },
  { firstName: "Jeff", lastName: "Angell", companyName: "BKB", title: "Owner", email: "jeffersonangell@gmail.com", phone: "(206) 227-1958" },
  { firstName: "Jimmer", lastName: "Adelhart", companyName: "Black Rock Industries", title: "Estimator", email: "JimmerA@blackrockind.com", phone: "(503) 927-6454" },
  { firstName: "Ben", lastName: "Gebhardt", companyName: "Blue Sound Construction, Inc.", title: "Principal", email: "ben@bluesoundconstruction.com", phone: "(206) 535-7961" },
  { firstName: "Alexis", lastName: "Williams-Edward", companyName: "BMDC", title: "Project Manager", email: "alexis@belottimchugh.com", phone: "(206) 822-2620" },
  { firstName: "Blake", lastName: "Hepner", companyName: "BMDC", title: "Site Supervisor", email: "blake@belottimchugh.com", phone: "(425) 625-6261" },
  { firstName: "BMDC - Office Info", lastName: "Billing", companyName: "BMDC", title: "Office Admin", phone: "(206) 588-0931" },
  { firstName: "Brad", lastName: "Vuyk", companyName: "BMDC", title: "Site Supervisor", email: "brad@belottimchugh.com", phone: "(206) 229-2108" },
  { firstName: "Chris", lastName: "Hill", companyName: "BMDC", title: "Site Supervisor", email: "Chris@belottimchugh.com", phone: "(206) 532-1461" },
  { firstName: "Erimi", lastName: "Haggerty", companyName: "BMDC", title: "Accounting", email: "erimi@belottimchugh.com", phone: "(206) 295-2658" },
  { firstName: "Jon", lastName: "Dasho", companyName: "BMDC", title: "Project Manager", email: "jon@belottimchugh.com", phone: "(206) 755-6042" },
  { firstName: "Kara", lastName: "Hewlett", companyName: "BMDC", title: "Project Manager", email: "kara@belottimchugh.com", phone: "(206) 491-1910" },
  { firstName: "Kurt", lastName: "Trester", companyName: "BMDC", title: "Project Manager", email: "kurt@belottimchugh.com", phone: "(206) 465-5766" },
  { firstName: "LeAnna", lastName: "Chard", companyName: "BMDC", title: "Project Engineer", email: "leanna@belottimchugh.com", phone: "(253) 722-4241" },
  { firstName: "Lonny", lastName: "Carr", companyName: "BMDC", title: "Site Supervisor", email: "lonny@belottimchugh.com", phone: "(206) 518-0931" },
  { firstName: "Michael", lastName: "LaFreniere", companyName: "BMDC", title: "Site Supervisor", email: "michael@belottimchugh.com", phone: "(206) 910-6351" },
  { firstName: "Natalee", lastName: "Ballard", companyName: "BMDC", title: "Office Admin", email: "natalee@belottimchugh.com", phone: "(425) 890-3481" },
  { firstName: "Nate", lastName: "Reister", companyName: "BMDC", title: "Project Manager", email: "Nate@belottimchugh.com", phone: "(206) 643-2841" },
  { firstName: "Phil", lastName: "Collins", companyName: "BMDC", title: "Site Supervisor", email: "Phil@belottimchugh.com", phone: "(425) 293-4424" },
  { firstName: "Robb", lastName: "Kirby", companyName: "BMDC", title: "Site Supervisor", email: "robb@belottimchugh.com", phone: "(206) 972-3495" },
  { firstName: "Sara", lastName: "Heriot", companyName: "BMDC", title: "Office Admin", email: "admin@belottimchugh.com" },
  { firstName: "Shane", lastName: "Zike", companyName: "BMDC", title: "Project Manager", email: "shane@belottimchugh.com", phone: "(206) 755-6042" },
  { firstName: "Stephen", lastName: "Freni", companyName: "BMDC", title: "Site Supervisor", email: "Stephen@belottimchugh.com", phone: "(425) 830-0997" },
  { firstName: "Tim", lastName: "Kairez", companyName: "BMDC", title: "Project Manager", email: "tim@belottimchugh.com", phone: "(425) 757-4591" },
  { firstName: "Todd", lastName: "McHugh", companyName: "BMDC", title: "Owner", email: "todd@belottimchugh.com", phone: "(206) 458-0570" },
  { firstName: "Wayd", lastName: "Munro", companyName: "BMDC", title: "Project Manager", email: "Wayd@belottimchugh.com", phone: "(206) 778-6895" },
  { firstName: "Alex", lastName: "Davella", companyName: "BNBuilders", title: "Project Manager", phone: "(413) 478-9234" },
  { firstName: "Jack", lastName: "Duffy", companyName: "BNBuilders", title: "Project Manager", email: "Jack.Duffy@bnbuilders.com", phone: "(425) 802-5653" },
  { firstName: "Rachael", lastName: "Baresh", companyName: "BNBuilders", title: "Estimator", email: "Rachael.Baresh@bnbuilders.com", phone: "(206) 719-5295" },
  { firstName: "Steve", lastName: "Watkins", companyName: "BNBuilders", title: "Estimator", email: "Steve.Watkins@bnbuilders.com", phone: "(206) 462-9195" },
  { firstName: "Tony", lastName: "Wagner", companyName: "BNBuilders", title: "Site Supervisor", email: "Tony.Wagner@bnbuilders.com", phone: "(301) 343-6856" },
  { firstName: "Chris", lastName: "Kinkade", companyName: "Bodhi", title: "Estimator", email: "fooch5150@hotmail.com", phone: "(206) 992-8019" },
  { firstName: "Clayton", lastName: "Inman", companyName: "Boundless Construction Co", title: "Project Engineer", email: "boundlessconstructioncompany@gmail.com", phone: "(253) 359-0128" },
  { firstName: "Andrea", lastName: "Dobihal", companyName: "Brass Tacks NW", title: "Project Manager", email: "andrea@brasstacksnw.com", phone: "(206) 235-0055" },
  { firstName: "Martin", lastName: "Josund", companyName: "Bright Street Construction", email: "brightstreet@comcast.net", phone: "(206) 391-2812" },
  { firstName: "Erik", lastName: "Hazelton", companyName: "Brightwork", title: "Site Supervisor", email: "erik@brightworkbuilders.com", phone: "(206) 228-9683" },
  { firstName: "Gary", lastName: "Timpe", companyName: "Brightwork", title: "Owner", email: "gary@brightworkbuilders.com", phone: "(206) 303-9112" },
  { firstName: "Malcolm", lastName: "Dole", companyName: "Brightwork", title: "Project Manager", email: "malcolm@brightworkbuilders.com" },
  { firstName: "Michele", lastName: "Hill", companyName: "Broderick Architects", title: "Project Manager", email: "michele@broderickarchitects.com", phone: "(206) 682-7525" },
  { firstName: "Andy", lastName: "Ziskis", companyName: "Brother builders", title: "Owner", email: "Andy@builderbrothersnw.com", phone: "(206) 305-4884" },
  { firstName: "Brian", lastName: "", companyName: "Brother builders", title: "Site Supervisor", phone: "7155333489" },
  { firstName: "Justin", lastName: "Massey", companyName: "Brother builders", title: "Owner", email: "Justin@builderbrothersnw.com", phone: "(206) 661-2801" },
  { firstName: "Garrett", lastName: "Stern", companyName: "Build Group", title: "Estimator", email: "garrett.stern@buildgc.com", phone: "(303) 594-9889" },
  { firstName: "Vinay", lastName: "Khadke", companyName: "Build Group", title: "Estimator", email: "vinay.khadke@buildgc.com", phone: "(206) 670-5392" },
  { firstName: "Linda", lastName: "Burman", companyName: "Burman Design", title: "Engineer", email: "linda@burman.design", phone: "1 253 508 2658" },
  { firstName: "Ed", lastName: "Kopp", companyName: "Canright", title: "Owner", email: "ed@canrightconstruction.net", phone: "(206) 786-7444" },
  { firstName: "Greg", lastName: "Canright", companyName: "Canright", title: "Owner", email: "greg@canrightconstruction.net", phone: "(206) 947-6433" },
  { firstName: "Brad", lastName: "", companyName: "Capitol Hill Construction", title: "Project Manager", phone: "5035224881" },
  { firstName: "Tyson", lastName: "", companyName: "Capitol Hill Construction", title: "Office", phone: "12067781690" },
  { firstName: "Rory", lastName: "Richardson", companyName: "Cardinal", title: "Office", phone: "(425) 221-1012" },
  { firstName: "Kelly", lastName: "Davis", companyName: "Central Gasses", title: "Sales Rep", email: "kellydavis@centralgases.com", phone: "(206) 271-7477" },
  { firstName: "Teresa", lastName: "Bucholz", companyName: "Central Welding", title: "Sales Rep", email: "teresabucholz@centralwelding.com", phone: "(206) 856-2247" },
  { firstName: "Paul", lastName: "Lakeman", companyName: "CFM", title: "Project Manager", email: "paul@cfm-hvacr.com", phone: "(206) 391-1771" },
  { firstName: "Cindy", lastName: "Huang", companyName: "Chain Construction", title: "Accounting", email: "cindy@chaincos.com", phone: "(425) 985-0540" },
  { firstName: "Erin", lastName: "Cassidy", companyName: "Chain Construction", title: "General Manager", email: "erin@chaincos.com", phone: "(206) 437-0710" },
  { firstName: "Frank", lastName: "Martin", companyName: "Chain Construction", title: "Owner", email: "frank@chaincos.com", phone: "(206) 902-7664" },
  { firstName: "Shane", lastName: "Pierpoint", companyName: "Chain Construction", title: "Project Manager", email: "shane@chaincos.com", phone: "(206) 730-3106" },
  { firstName: "Rick", lastName: "Chesmore", companyName: "Chesmore Buck Architecture", title: "Architecture", email: "rick@chesmorebuck.com", phone: "(425) 679-0907" },
  { firstName: "Aaron Kelley", lastName: "", companyName: "Clark Construction Group", title: "Estimator", email: "aaron.kelley@clarkconstruction.com", phone: "(206) 308-6280" },
  { firstName: "Tina", lastName: "Song", companyName: "Clark Construction Inc", title: "Estimator", email: "tina@clarkconstruct.com", phone: "(206) 866-8359" },
  { firstName: "John", lastName: "Klier", companyName: "CMA Restaurant Supply", title: "Sales Rep", email: "johnk@cmarestaurantsupply.com" },
  { firstName: "Danny", lastName: "Sayah", companyName: "Coastal Construction", title: "Owner", email: "danny@coastalremodels.com", phone: "(206) 499-7155" },
  { firstName: "Jordan", lastName: "Yowell", companyName: "Coastal Construction", title: "Estimator", email: "jordyn@coastalremodels.com", phone: "(425) 999-5544" },
  { firstName: "Kristina", lastName: "Eich", companyName: "Coastal Construction", title: "Accounting", email: "kristina@coalstalremodels.com", phone: "(206) 812-9147" },
  { firstName: "Beth", lastName: "Tschider", companyName: "Cobalt Construction", title: "Office Admin", email: "beth.cobalt@gmail.com", phone: "(206) 683-6382" },
  { firstName: "Brian", lastName: "Tschider", companyName: "Cobalt Construction", title: "Owner", email: "brian@cobaltconst.com", phone: "(206) 947-6682" },
  { firstName: "Trevor", lastName: "Colbear", companyName: "Colbear Group", title: "Project Manager", email: "trevor@colbeargroup.com", phone: "(858) 736-1770" },
  { firstName: "Alex", lastName: "Olson", companyName: "Colvos", title: "Site Supervisor", email: "aolson@colvosconstruction.com" },
  { firstName: "Devin", lastName: "Page", companyName: "Colvos", title: "Estimator", email: "dpage@colvosconstruction.com", phone: "(253) 844-4640 press 1" },
  { firstName: "Gabrielle", lastName: "Schwartz", companyName: "Colvos", title: "Estimator", email: "gschwartz@colvosconstruction.com" },
  { firstName: "Lynnae", lastName: "Wilson", companyName: "Colvos", title: "Office", email: "lwilson@colvosconstruction.com", phone: "(253) 844-4640" },
  { firstName: "Max", lastName: "Barton", companyName: "Colvos", title: "Estimator", email: "MBarton@colvosconstruction.com", phone: "1 253-844-4640 press 3" },
  { firstName: "Mike", lastName: "McGlothlin", companyName: "Colvos", title: "Project Manager", email: "mmcglothlin@colvosconstruction.com" },
  { firstName: "Sara", lastName: "Smith", companyName: "Colvos", title: "Accounting", email: "ssmith@colvosconstruction.com", phone: "253-844-4640  x 107" },
  { firstName: "Tanya", lastName: "Russell", companyName: "Colvos", title: "Project Manager", email: "trussell@colvosconstruction.com", phone: "(253) 290-2326" },
  { firstName: "Kristi", lastName: "Brown", companyName: "Communion", title: "Owner", email: "kristi@thatbrowngirlcooks.com" },
  { firstName: "Bob", lastName: "Byers", companyName: "Consolidated Supply", title: "Accounting", email: "bob.byers@consolidatedsupply.com" },
  { firstName: "Cassie", lastName: "Harris", companyName: "Consolidated Supply", title: "Estimator", email: "cassie.harris@consolidatedsupply.com" },
  { firstName: "Jimmy", lastName: "Laufer", companyName: "Consolidated Supply", title: "Sales Rep", email: "jimmy.laufer@consolidatedsupply.com" },
  { firstName: "Kevin", lastName: "Dallman", companyName: "Consolidated Supply", title: "Sales Rep", email: "kevin.dallman@consolidatedsupply.com" },
  { firstName: "Marcy", lastName: "Zeiger", companyName: "Consolidated Supply", title: "Estimator", email: "marcy.zeiger@consolidatedsupply.com" },
  { firstName: "Mike", lastName: "Smith", companyName: "Consolidated Supply", title: "Sales Rep", email: "michael.smith@consolidatedsupply.com", phone: "(206) 619-7929" },
  { firstName: "Justin", lastName: "Coble", companyName: "Constructive Energy", title: "Project Manager", email: "Justinc@constructiveenergy.com", phone: "(206) 372-4983" },
  { firstName: "Tim", lastName: "Brown", companyName: "Copacetic, LLC", title: "Estimator", email: "7613greenwood@gmail.com", phone: "(512) 694-0866" },
  { firstName: "Jeanne", lastName: "Westbrook", companyName: "Cornerstone", title: "Office Admin", email: "jean@cornerstone425.com", phone: "(425) 748-4775" },
  { firstName: "Darwen", lastName: "Ullestad", companyName: "CORstone", title: "Estimator", email: "darwen@corstonellc.com", phone: "(360) 862-8316" },
  { firstName: "Samantha", lastName: "Filichia", companyName: "CORstone", title: "Project Manager", email: "bids@corstonell.com", phone: "(360) 243-3021" },
  { firstName: "Bryon", lastName: "Atterberry", companyName: "CPM Tenant Improvement Solutions", title: "Estimator", email: "bryon@cpmnw.com", phone: "360-863-6705 x 712" },
  { firstName: "Ryan", lastName: "Tappert", companyName: "CPM Tenant Improvement Solutions", title: "Estimator", email: "ryan@cpmnw.com", phone: "(425) 870-2905" },
  { firstName: "Wil", lastName: "Oliver", companyName: "CPM Tenant Improvement Solutions", title: "Estimator", phone: "(206) 530-3553" },
  { firstName: "Liam", lastName: "McPherson", companyName: "Crescent Builds", title: "Project Manager", email: "liam@crescentbuilds.com", phone: "(425) 894-0905" },
  { firstName: "Luther", lastName: "Chatel", companyName: "CRW Building", title: "Estimator", email: "luther@crwbuildingco.com", phone: "(206) 499-7179" },
  { firstName: "Brad", lastName: "Larson", companyName: "CSI", title: "Site Supervisor", email: "blarson@csigc.com", phone: "(253) 365-3546" },
  { firstName: "Mike", lastName: "Gorman", companyName: "CSI", title: "Estimator", email: "mgorman@csigc.com", phone: "(503) 969-7403" },
  { firstName: "Mike", lastName: "Van Kirk", companyName: "CSI", title: "Project Manager", email: "mvankirk@csigc.com", phone: "(503) 805-6731" },
  { firstName: "Tom", lastName: "Scott", companyName: "CSI", title: "Estimator", email: "tscott@csigc.com", phone: "(503) 969-7406" },
  { firstName: "Alice", lastName: "Wise", companyName: "Dallas Commercial Builders", title: "Estimator", email: "awise@ccgcommercialgroup.com", phone: "1 214-773-8338 (Cell)" },
  { firstName: "Danica", lastName: "Swanson", companyName: "DB Accounting", title: "Accounting", email: "help@bbtaxpros.com", phone: "(503) 342-2015" },
  { firstName: "Alex", lastName: "Bozhko", companyName: "Deacon", title: "Site Supervisor", email: "Alex.Bozhko@deacon.com", phone: "(206) 247-3574" },
  { firstName: "Chad", lastName: "Snopko", companyName: "Deacon", title: "Estimator", email: "chad.snopko@deacon.com", phone: "(425) 284-4000" },
  { firstName: "Steven", lastName: "Fields", companyName: "Deacon", title: "Estimator", email: "steven.fields@deacon.com", phone: "(206) 584-5671" },
  { firstName: "Taylor", lastName: "Kennedy", companyName: "Deacon", title: "Project Manager", email: "taylor.kennedy@deacon.com", phone: "(206) 305-7131" },
  { firstName: "Rachel", lastName: "Fretz", companyName: "Dempsey", title: "Estimator", email: "rfretz@dempseyconstruction.com", phone: "760-918-6900 ext. 110" },
  { firstName: "Jordan", lastName: "Cooper", companyName: "Deru Market", title: "Owner", phone: "(425) 802-1449" },
  { firstName: "Benjamin", lastName: "Wishall", companyName: "DH Pace Door Services Group", title: "Project Manager", email: "Ben.Wishall@dhpace.com", phone: "(206) 624-3667" },
  { firstName: "Bailey", lastName: "Showstead", companyName: "Dolan Build", title: "Office Admin", email: "office@dolangc.com", phone: "(206) 747-7792" },
  { firstName: "Joey", lastName: "Burke", companyName: "Dolan Build", title: "Site Supervisor", email: "joey@dolangc.com", phone: "(612) 910-0334" },
  { firstName: "Jon", lastName: "Rasnic", companyName: "Dolan Build", title: "Site Supervisor", email: "jonathan@dolangc.com", phone: "(206) 321-3900" },
  { firstName: "Mike", lastName: "Nash", companyName: "Dolan Build", title: "Estimator", email: "michael@dolangc.com", phone: "(480) 532-8146" },
  { firstName: "Pat", lastName: "Dolan", companyName: "Dolan Build", title: "Project Manager", email: "pat@dolangc.com", phone: "12066592588" },
  { firstName: "Tim", lastName: "Dolan", companyName: "Dolan Build", title: "Office", email: "tim@dolangc.com", phone: "(206) 743-1095" },
  { firstName: "Adam", lastName: "Newman", companyName: "Dovetail", title: "Project Manager", email: "adamn@dovetailgc.com", phone: "(425) 444-7320" },
  { firstName: "Alex", lastName: "Dahl", companyName: "Dovetail", title: "Office Admin", email: "alexd@dovetailgc.com" },
  { firstName: "Ashley", lastName: "Sullivan", companyName: "Dovetail", title: "Estimator", email: "asullivan@dovetailgc.com", phone: "(206) 227-2653" },
  { firstName: "Barbara", lastName: "Hallinan", companyName: "Dovetail", title: "Office Admin", email: "barbarah@dovetailgc.com", phone: "(206) 545-0722" },
  { firstName: "Bob", lastName: "Moss", companyName: "Dovetail", title: "Project Manager", phone: "2066126286" },
  { firstName: "Daniel", lastName: "Archer", companyName: "Dovetail", title: "Site Supervisor", email: "daniel@dovetailgc.com", phone: "(206) 245-3651" },
  { firstName: "Jesse", lastName: "Knutson", companyName: "Dovetail", title: "Office Admin", email: "jessek@dovetailgc.com" },
  { firstName: "Joseph", lastName: "Curran", companyName: "Dovetail", title: "Project Manager", email: "josephc@dovetailgc.com", phone: "(206) 496-3846" },
  { firstName: "Katherine", lastName: "Acheson-Snow", companyName: "Dovetail", title: "Project Manager", email: "katherineas@dovetailgc.com", phone: "(469) 449-7682" },
  { firstName: "Kevin", lastName: "Wright", companyName: "Dovetail", title: "Site Supervisor", email: "kevinw@dovetailgc.com", phone: "(425) 205-7188" },
  { firstName: "Marley", lastName: "Tomic-Beard", companyName: "Dovetail", title: "Site Supervisor", email: "marley@metisconstructioninc.com", phone: "(206) 618-7506" },
  { firstName: "Matt", lastName: "Lawson", companyName: "Dovetail", title: "Site Supervisor", email: "Mattl@dovetailgc.com", phone: "(469) 449-7682" },
  { firstName: "Mike", lastName: "Hall", companyName: "Dovetail", title: "Project Manager", email: "michaelh@dovetailgc.com", phone: "(206) 354-0198" },
  { firstName: "Nic", lastName: "Villano", companyName: "Dovetail", title: "Site Supervisor", email: "nicv@dovetailgc.com", phone: "12067755131" },
  { firstName: "Pamela", lastName: "Black", companyName: "Dovetail", title: "Project Accountant", email: "pamelab@dovetailgc.com", phone: "(206) 683-0234" },
  { firstName: "Paul", lastName: "Dersham", companyName: "Dovetail", title: "Site Supervisor", email: "pauld@dovetailgc.com", phone: "(206) 473-1548" },
  { firstName: "Paul", lastName: "Pederson", companyName: "Dovetail", title: "Project Manager", email: "ppederson@dovetailgc.com", phone: "(206) 601-2358" },
  { firstName: "Roger", lastName: "Shurtleff", companyName: "Dovetail", title: "Project Manager", email: "roger@dovetailgc.com", phone: "(206) 372-7245" },
  { firstName: "Scott", lastName: "Edwards", companyName: "Dovetail", title: "Owner", email: "scott@dovetailgc.com", phone: "(206) 372-7247" },
  { firstName: "Seana", lastName: "Hesse", companyName: "Dovetail", title: "Office Admin", email: "ap@dovetailgc.com" },
  { firstName: "Elver", lastName: "Renfro", companyName: "DPI", title: "Site Supervisor", email: "ElverR@dpinc.net", phone: "(206) 707-5320" },
  { firstName: "Quinn", lastName: "Anderson", companyName: "DPI", title: "Estimator", email: "Quinn@dpinc.net", phone: "(206) 423-7164" },
  { firstName: "Barty", lastName: "Nicholson", companyName: "Dyna Builders", email: "bartynicholson@dynacontracting.com" },
  { firstName: "Dawn", lastName: "Skinsziel", companyName: "Dyna Builders", title: "Accounting", email: "dskindziel@dyna.builders", phone: "206-297-6369 x113" },
  { firstName: "Kevin", lastName: "Sikes", companyName: "Dyna Builders", email: "ksikes@dyna.builders.com", phone: "(206) 291-0755" },
  { firstName: "Jered", lastName: "Gallegos", companyName: "Eco Line", title: "Estimator", email: "ecolinepm@gmail.com", phone: "(206) 948-1351" },
  { firstName: "Aubree", lastName: "Livingston", companyName: "ELS Construction", title: "Estimator", email: "alivingston@els-construction.com", phone: "(832) 737-6038" },
  { firstName: "Kara", lastName: "Samac", companyName: "ESR Hospitality", title: "Project Manager", email: "kara.samac@esrhospitality.com" },
  { firstName: "Michael", lastName: "Pagana", companyName: "ESR Hospitality", title: "Project Engineer", email: "michael@esrhospitality.com", phone: "(321) 279-5659" },
  { firstName: "Paul", lastName: "Sommer", companyName: "ESR Hospitality", title: "Project Manager", email: "paul@esrhospitality.com", phone: "(206) 251-2657" },
  { firstName: "Kara", lastName: "Samac", companyName: "Ethan Stowell Restaurants", title: "Director of Development", email: "kara.samac@esrhospitality.com", phone: "(253) 486-3500" },
  { firstName: "Hannah", lastName: "Eilers", companyName: "Evergreen Concrete Cutting", title: "Office Admin", email: "<Hannah@evergreenconcretecutting.com", phone: "(253) 826-7644" },
  { firstName: "Ty", lastName: "", companyName: "Evergreen Concrete Cutting", email: "Ty@evergreenconcretecutting.com", phone: "(253) 405-7912" },
  { firstName: "Kris", lastName: "Jolley", companyName: "Evergreen Hydronics", title: "Owner", email: "evergreenhydronicsllc@gmail.com", phone: "(206) 423-5156" },
  { firstName: "Chad", lastName: "Dale", companyName: "Evolution Projects", title: "Owner", email: "chaddale@gmail.com", phone: "734-320-1846" },
  { firstName: "Ian", lastName: "Loveless", companyName: "Evolution Projects", title: "Project Manager", email: "ian@evolutionprojects.com", phone: "(425) 404-1811" },
  { firstName: "Ira", lastName: "Gerlich", companyName: "Evolution Projects", title: "Office", email: "ira@evolutionprojects.com" },
  { firstName: "Ji", lastName: "", companyName: "Evolution Projects", title: "Project Manager", phone: "(703) 801-2925" },
  { firstName: "Valery", lastName: "Vargas", companyName: "Evolution Projects", title: "Project Manager", email: "hello@valeryvargas.com", phone: "(206) 849-8049" },
  { firstName: "Yves", lastName: "Vetter", companyName: "Evolution Projects", title: "Project Manager", email: "yves@evolutionprojects.com", phone: "2067997545" },
  { firstName: "Adam", lastName: "Drew", companyName: "Falcon Construction", title: "Project Manager", email: "falconconstructionwa@gmail.com", phone: "(206) 949-9062" },
  { firstName: "John", lastName: "Crise", companyName: "FarWest", title: "Estimator", email: "john@farwestti.com", phone: "206.930.7336 ext 3" },
  { firstName: "Matt", lastName: "Haba", companyName: "Farwest Advisors llc", title: "Engineer", email: "matt.haba@hotmail.com", phone: "(206) 459-4366" },
  { firstName: "Connor", lastName: "Petrie", companyName: "Ferguson Construction", title: "Project Manager", email: "connorp@fergusonconstruction.com" },
  { firstName: "Justin", lastName: "Armstrong", companyName: "Ferguson Construction", title: "Project Manager", email: "Justina@fergusonconstruction.com" },
  { firstName: "Tom", lastName: "Whiteman", companyName: "Ferguson Construction", title: "Project Manager", email: "tomw@fergusonconstruction.com" },
  { firstName: "Dave", lastName: "Mosbach", companyName: "Ferguson Supply", title: "Sales Rep", email: "david.mosbach@ferguson.com", phone: "(425) 280-0740" },
  { firstName: "Derek", lastName: "Ivanoff", companyName: "Ferguson Supply", title: "Sales Rep", email: "Derek.ivanoff@ferguson.com" },
  { firstName: "Jeremy", lastName: "Ihler", companyName: "Ferguson Supply", title: "Sales Rep", email: "jeremy.ihler@ferguson.com" },
  { firstName: "Jim", lastName: "Ballock", companyName: "Ferguson Supply", title: "Sales Rep", email: "james.ballock@ferguson.com", phone: "(206) 919-8385" },
  { firstName: "John", lastName: "Jones", companyName: "Ferguson Supply", title: "Sales Rep", email: "John.jones@ferguson.com" },
  { firstName: "Carrie", lastName: "Whitton", companyName: "FORMA Construction", title: "Office", email: "CarrieW@formacc.com", phone: "(206) 626-0256" },
  { firstName: "Robert", lastName: "Michaels", companyName: "Fradkin Fine Construction", email: "rmichaels@fradkin.co", phone: "(206) 706-1123" },
  { firstName: "Kurtis", lastName: "Davis", companyName: "Fulcrum", title: "Project Manager", email: "kdavis@fulcrumconstruction.com", phone: "(310) 339-9477" },
  { firstName: "Russell", lastName: "Fuller", companyName: "Fuller Living Const.", title: "Project Manager", email: "fullerlivingconstruction@gmail.com" },
  { firstName: "Matt", lastName: "Lewis", companyName: "Gaspars", title: "Estimator", email: "matt@gaspars.com", phone: "(206) 293-8040" },
  { firstName: "Saman", lastName: "Ranjbar", companyName: "Gaspars", title: "Site Supervisor", email: "sranjbar@gaspars.com", phone: "(832) 641-5524" },
  { firstName: "David", lastName: "Schroeder", companyName: "GenCap", title: "Project Manager", email: "davids@gencapgc.com", phone: "(251) 895 - 9147" },
  { firstName: "Alan", lastName: "Cagle", companyName: "GenCap", title: "Project Manager", email: "alanc@gencapgc.com", phone: "(425) 864-1009" },
  { firstName: "Amy", lastName: "Riding", companyName: "GenCap", title: "Estimator", email: "amyr@gencapgc.com", phone: "(425) 876-2104" },
  { firstName: "Andy", lastName: "Cygan", companyName: "GenCap", title: "Project Engineer", email: "andyc@gencapgc.com", phone: "(425) 686 - 0908" },
  { firstName: "Ken", lastName: "Dubell", companyName: "GenCap", title: "Site Supervisor", email: "kend@gencapgc.com", phone: "(425) 308-5311" },
  { firstName: "Nathan", lastName: "Sutherland", companyName: "GenCap", title: "Project Engineer", email: "nathan@gencapgc.com", phone: "(206) 366-5720" },
  { firstName: "Zach", lastName: "Altenhofen", companyName: "GenCap", title: "Project Manager", email: "zacha@gencapgc.com", phone: "(206) 910-3977" },
  { firstName: "John", lastName: "Dellinger", companyName: "Goudy", title: "Estimator", email: "john@goudycc.com", phone: "(206) 412-4104" },
  { firstName: "Susan", lastName: "Martins", companyName: "Gray West Inc", title: "Estimator", email: "smartins@gray.com", phone: "(714) 491-1317 ext 108" },
  { firstName: "Chris", lastName: "Apostolos", companyName: "Guardian Water & Power" },
  { firstName: "Nick", lastName: "Meyer", companyName: "Hammer & Hand", title: "Estimator", email: "nmeyer@hammerandhand.com", phone: "(206) 200-7322" },
  { firstName: "John", lastName: "Baker", companyName: "Harco Construction", title: "Estimator", email: "jbaker@harcoinc.us", phone: "(951) 684-1909 ext 1" },
  { firstName: "Max", lastName: "Genereaux", companyName: "Hattie's Hat", title: "Owner", email: "max@sunsettavern.com", phone: "(206) 228-6299" },
  { firstName: "Chuck", lastName: "Meyer", companyName: "Hazel point", title: "Project Manager", email: "chuckm@hazelpointco.com", phone: "(206) 612-3611" },
  { firstName: "Gabrielle", lastName: "", companyName: "Hazel point", title: "Project Manager", email: "gabrieller@hazelpointco.com", phone: "2069928628" },
  { firstName: "Norm", lastName: "Smith", companyName: "Hazel point", title: "Project Manager", email: "norms@hazelpointco.com", phone: "'+1 (206) 354-7816" },
  { firstName: "Jonathan", lastName: "Teng", companyName: "Heliotrope", email: "jteng@heliotropearchitects.com", phone: "(208) 413-2611" },
  { firstName: "Brandon", lastName: "Julao", companyName: "Hilber's Inc", title: "Estimator", email: "bjulao@hilbersinc.com", phone: "530-441-6342 ext. 142" },
  { firstName: "Brian", lastName: "Hilliard", companyName: "Hilliard Construction", title: "Owner", email: "hilliardmbrian@gmail.com", phone: "(310) 955-8687" },
  { firstName: "Dana", lastName: "Rieckhoff", companyName: "Horizon", title: "Estimator", email: "danar@horizonretail.com", phone: "(262) 865-6228" },
  { firstName: "Michelle", lastName: "Salerno", companyName: "Horizon", title: "Estimator", email: "michelles@horizonretail.com", phone: "(262) 865-6166" },
  { firstName: "Sara", lastName: "Miller", companyName: "Horizon", title: "Estimator", email: "saram@horizonretail.com", phone: "(262) 865-6234" },
  { firstName: "Gordon", lastName: "Krippaehne", companyName: "Howard S. Wright", title: "Estimator", email: "gkrippaehne@hswc.com", phone: "(206) 380-6792" },
  { firstName: "Brent", lastName: "Quigley", companyName: "HV Engineering", email: "brent@hvengineering.biz" },
  { firstName: "Brian", lastName: "Roetcisoender", companyName: "HV Engineering", title: "Engineer", email: "brian@hvengineering.biz", phone: "(206) 706-9669" },
  { firstName: "Dustin", lastName: "Johnson", companyName: "HV Engineering", email: "dustin@hvengineering.biz", phone: "206-706-9669 x 114" },
  { firstName: "Robert", lastName: "Brazier", companyName: "ICG Interstate Construction Group", title: "Estimator", email: "bob@interstateconstructiongroup.com", phone: "(253) 435-0949" },
  { firstName: "Keaton", lastName: "DeBord", companyName: "Ingersoll Rand", email: "Keaton.Debord@irco.com", phone: "(206) 406-1379" },
  { firstName: "Bob", lastName: "Besa", companyName: "InterServ LP", title: "Estimator", email: "RobertB@InterservLP.com", phone: "(310) 556-6800" },
  { firstName: "Joseph", lastName: "Irons", companyName: "Irons Brothers Construction", title: "Project Manager", email: "joseph@ironsbc.com", phone: "(206) 418-9932" },
  { firstName: "John", lastName: "Palazzotto", companyName: "JAG Building Group", title: "Estimator", email: "john.palazzotto@jagbuilding.com", phone: "1-239-540-2700 x28" },
  { firstName: "Jonathan", lastName: "Davidson", companyName: "JAG Building Group", title: "Estimator", email: "JonathanD@JAGbuilding.com" },
  { firstName: "Eric", lastName: "Cavanaugh", companyName: "James Co / Northern Star Construction", title: "Owner", email: "eric@jamescoinc.com", phone: "(425) 765-4813" },
  { firstName: "Liz", lastName: "Whitemore", companyName: "James E. John Construction Co., Inc.", title: "Estimator", email: "lwhitmore@jejohn.com", phone: "1 360-696-0837" },
  { firstName: "Jason", lastName: "Manges", companyName: "Jason Manges", title: "Office", email: "jasonm@beacondevgroup.com", phone: "(206) 715-6527" },
  { firstName: "Austin", lastName: "", companyName: "Jay's Garage", phone: "(206) 291-7909" },
  { firstName: "Eric Simonson", lastName: "", companyName: "JM Riley", title: "Site Supervisor", email: "erics@jmrileyco.com", phone: "(425) 466-5750" },
  { firstName: "Jeremiah", lastName: "Godak", companyName: "JM Riley", title: "Office Admin", email: "admin@jmrileyco.com", phone: "(425) 786-9292" },
  { firstName: "Kevin", lastName: "Kimler", companyName: "JM Riley", title: "Project Manager", email: "kevink@jmrileyco.com", phone: "(425) 761-2952" },
  { firstName: "Lance", lastName: "Jacobsen", companyName: "JM Riley", title: "Site Supervisor", email: "LanceJ@jmrileyco.com", phone: "(206) 271-3738" },
  { firstName: "Laura", lastName: "Stachel", companyName: "JM Riley", title: "Accounting", email: "lauras@jmrileyco.com", phone: "(425) 786-9292" },
  { firstName: "Mike", lastName: "Kelly", companyName: "JM Riley", title: "Office", email: "mikek@jmrileyco.com", phone: "(206) 255-3035" },
  { firstName: "Nick", lastName: "Vermeer", companyName: "JM Riley", title: "Site Supervisor", email: "nickv@jmrileyco.com", phone: "(206) 818-0240" },
  { firstName: "Scott", lastName: "Lindley", companyName: "JM Riley", title: "Site Supervisor", email: "ScottL@jmrileyco.com", phone: "(425) 625-9474" },
  { firstName: "Tom", lastName: "Schmidt", companyName: "JM Riley", title: "Project Manager", email: "toms@jmrileyco.com", phone: "(425) 531-0281" },
  { firstName: "Rachel", lastName: "Yang", companyName: "Joule", email: "joulerestaurant@gmail.com", phone: "(917) 250-1397" },
  { firstName: "Ernesto", lastName: "Orozco", companyName: "JTM", title: "Estimator", email: "eorozco@jtmconstruction.com", phone: "(206) 843-4420" },
  { firstName: "Jarrett", lastName: "Haynes", companyName: "JTM", title: "Estimator", email: "jhaynes@jtmconstruction.com", phone: "(206) 293-3137" },
  { firstName: "Lally", lastName: "", companyName: "Juice Box", email: "lally@ballardbeerbox.com", phone: "(206) 491-2063" },
  { firstName: "Edouardo", lastName: "Jordan", companyName: "Junebaby", email: "edouardo@thirdpower3.com", phone: "(206) 310-0750" },
  { firstName: "Sam", lastName: "Smith", companyName: "Junk Removal Inc", title: "Project Manager", phone: "(222) 222-2222" },
  { firstName: "Justin", lastName: "Suedel", companyName: "Just Cars Adv Locksmith", title: "Owner", email: "info@justcarsal.com", phone: "(206) 769-4485" },
  { firstName: "Sky", lastName: "Norris", companyName: "K. Fox Insulation", title: "Estimator", email: "sky@kfoxinsulation.com", phone: "(425) 345-6273" },
  { firstName: "April", lastName: "Baumgardner", companyName: "Keller Supply", title: "Sales Rep", email: "abaumgar@kellersupply.com", phone: "(206) 702-2606" },
  { firstName: "Derek", lastName: "Kiel", companyName: "Keller Supply", title: "Sales Rep", email: "Dkiel@kellersupply.com", phone: "(253) 394-2282" },
  { firstName: "Jace", lastName: "Hostvedt", companyName: "Keller Supply", title: "Sales Rep", email: "jhostved@kellersupply.com", phone: "(206) 550-6938" },
  { firstName: "Michael", lastName: "Keller", companyName: "Keller Supply", title: "Owner", email: "mkeller@kellersupply.com", phone: "(206) 779-9909" },
  { firstName: "Ron", lastName: "Acena", companyName: "Keller Supply", title: "Sales Rep", email: "racena@kellersupply.com", phone: "(206) 285-3800" },
  { firstName: "Stephanie", lastName: "Fish", companyName: "Keller Supply", title: "Sales Rep", email: "sfish@kellersupply.com", phone: "(206) 270-4724" },
  { firstName: "Patrick", lastName: "Pearse McAleese", companyName: "Kells Irish Bar", email: "Patrick@kellsirish.com", phone: "(206) 851-6530" },
  { firstName: "Maninder", lastName: "Singh", companyName: "Kiddie Academy", title: "Owner", email: "msingh@kagreaterseattle.com", phone: "(425) 223-7583" },
  { firstName: "Mike Romero", lastName: "", companyName: "Kiddie Academy", title: "Site Supervisor", email: "MRomano@kagreaterseattle.com", phone: "(941) 246-9297" },
  { firstName: "Lisa", lastName: "Davenport", companyName: "King Construction", title: "Office Admin", email: "lisa@kingcon.co" },
  { firstName: "Matt", lastName: "King", companyName: "King Construction", title: "Owner", email: "matt@kingcon.co", phone: "(206) 963-3431" },
  { firstName: "Jordan", lastName: "Melnikoff", companyName: "Le Coin", email: "jordan@lecoinseattle.com", phone: "(206) 734-7082" },
  { firstName: "Denise", lastName: "Ficca", companyName: "Mallet", title: "Project Engineer", email: "denise@malletdesignbuild.com", phone: "(253) 820-7424" },
  { firstName: "Ryan", lastName: "Lingol", companyName: "Mallet", title: "Site Supervisor", email: "rlingol@malletdesignbuild.com", phone: "(206) 510-8656" },
  { firstName: "Tanner", lastName: "Strawn", companyName: "Mallet", title: "Project Manager", email: "tstrawn@malletdesignbuild.com", phone: "(425) 466-7237" },
  { firstName: "David", lastName: "Lazo", companyName: "Marination", email: "david@marinationmobile.com" },
  { firstName: "Tracy", lastName: "Korince", companyName: "Mavacon", title: "Estimator", email: "tracy_korince@mavacon.com", phone: "1 844-628-2266" },
  { firstName: "Rick", lastName: "Moisant", companyName: "Mechanical Resource Services", email: "rick@mechanicalresourceservices.com", phone: "(206) 510-7349" },
  { firstName: "Jason", lastName: "Minami", companyName: "Method Construction", title: "Office", email: "jason@methodconstruction.com", phone: "(206) 250-2427" },
  { firstName: "Kelsey", lastName: "Kline", companyName: "Method Construction", title: "Accounting", email: "kelsey@methodconstruction.com", phone: "(425) 210-2176" },
  { firstName: "Miles", lastName: "Blankmentship", companyName: "Method Construction", email: "miles@methodconstruction.com", phone: "(707)-834-0945" },
  { firstName: "Wendi", lastName: "Minami", companyName: "Method Construction", title: "Office Admin", email: "wendi@methodconstruction.com", phone: "206- 861-2950" },
  { firstName: "Jacob", lastName: "Strantz", companyName: "Driftwood", title: "Site Supervisor", email: "jacob@driftwoodnw.com", phone: "(206) 960-8876" },
  { firstName: "Jesse", lastName: "Holegate", companyName: "Driftwood", title: "Estimator", email: "jesse@driftwoodnw.com", phone: "(208) 596-2543" },
  { firstName: "Sebastian", lastName: "Kimura", companyName: "Metis Construction", email: "sebastian@metisconstructioninc.com", phone: "(206) 512-7212" },
  { firstName: "(PK) Poncharee", lastName: "Kounpungchart", companyName: "Metis Construction", title: "Project Manager", email: "pk@metisconstruction.com", phone: "(206) 453-8189" },
  { firstName: "Amos", lastName: "West", companyName: "Metis Construction", title: "Site Supervisor", email: "amos@metisconstructioninc.com", phone: "(206) 552-5135" },
  { firstName: "Andrew", lastName: "Madden", companyName: "Metis Construction", title: "Project Engineer", email: "andy@metisconstructioninc.com", phone: "(206) 605-8246" },
  { firstName: "Chris", lastName: "Monroe", companyName: "Metis Construction", title: "Site Supervisor", email: "Christopher@metisconstructioninc.com.com", phone: "(801) 970-6163" },
  { firstName: "Dan", lastName: "Rodgers", companyName: "Metis Construction", title: "Project Manager", email: "dan@metisconstructioninc.com", phone: "(206) 380-5997" },
  { firstName: "Ford", lastName: "Sorita", companyName: "Metis Construction", title: "Site Supervisor", email: "ford@metisconstructioninc.com" },
  { firstName: "Gabe", lastName: "Stern", companyName: "Metis Construction", title: "Estimator", email: "gabe@metisconstructioninc.com", phone: "(206) 786-9023" },
  { firstName: "Grant", lastName: "Eckman", companyName: "Metis Construction", title: "Site Supervisor", email: "grant@metisconstructioninc.com", phone: "(206) 271-8778" },
  { firstName: "Grant", lastName: "Glover", companyName: "Metis Construction", title: "Project Manager", email: "gglover@metisconstructioninc.com", phone: "2066127518" },
  { firstName: "Greg", lastName: "Miller", companyName: "Metis Construction", title: "Project Manager", email: "greg@metisconstructioninc.com", phone: "(720) 232-7991" },
  { firstName: "Jason", lastName: "Cameron", companyName: "Metis Construction", title: "Project Manager", email: "jason_e_cameron@msn.com", phone: "2065181095" },
  { firstName: "Joe", lastName: "McKay", companyName: "Metis Construction", title: "Site Supervisor", email: "joem.metis@gmail.com", phone: "(425) 286-9227" },
  { firstName: "Josh", lastName: "Anderson", companyName: "Metis Construction", title: "Site Supervisor", email: "josh.metis@gmail.com", phone: "(206) 234-9089" },
  { firstName: "Katelyn", lastName: "Frey-Booth", companyName: "Metis Construction", title: "Office Admin", email: "katelyn@metisconstructioninc.com", phone: "(425) 223-1159" },
  { firstName: "Mikel", lastName: "Palmer", companyName: "Metis Construction", title: "Site Supervizor", phone: "(206) 384-1928" },
  { firstName: "Nils", lastName: "Christian", companyName: "Metis Construction", title: "CFO", email: "nils@metisconstructioninc.com", phone: "(206) 356-4544" },
  { firstName: "Rebecca", lastName: "Roberts", companyName: "Metis Construction", title: "Accounting", email: "metisbookkeeping@gmail.com" },
  { firstName: "Rebekkah", lastName: "Madden", companyName: "Metis Construction", title: "Site Supervisor", email: "rebekkah@metisconstructioninc.com", phone: "(206) 708-6125" },
  { firstName: "Tom", lastName: "Hall", companyName: "Metis Construction", title: "Site Supervisor", email: "tom@metisconstructioninc.com", phone: "(206) 856-4375" },
  { firstName: "Joe", lastName: "Peterson", companyName: "Metropolitan", title: "Estimator", email: "jpeterson@metropolitancontracting.com", phone: "(206) 730-6547" },
  { firstName: "Lori", lastName: "Austin", companyName: "Metropolitan", title: "Project Manager", email: "laustin@metropolitancontracting.com" },
  { firstName: "Patrick", lastName: "Muma", companyName: "Metropolitan", title: "Project Manager", email: "pmuma@metropolitancontracting.com", phone: "(206) 854-4718" },
  { firstName: "Dale", lastName: "Stern", companyName: "MGAC", title: "Estimator", email: "dale.stern@mgac.com", phone: "(425) 351-8398" },
  { firstName: "Ralph", lastName: "Castellino", companyName: "Michou", email: "michouseattle@comcast.net", phone: "(206) 805-9127" },
  { firstName: "Frank", lastName: "(Mighty Kidz)", companyName: "Mighty Kidz", phone: "(206) 261-4422" },
  { firstName: "Grant", lastName: "Rico", companyName: "Model Restaurant Group", title: "Owner", email: "grant@modelrestaurantgroup.com", phone: "(360) 536-3133" },
  { firstName: "Oliver", lastName: "Little", companyName: "Monumental", title: "Project Manager", email: "oliver@monumentalundertaking.com", phone: "(206) 403-8507" },
  { firstName: "Eric", lastName: "Bauer", companyName: "Morita Bauer Construction", title: "Project Manager", email: "eric@moritabauer.com", phone: "(206) 999-6239" },
  { firstName: "Michael", lastName: "Dudley", companyName: "National Contractors Inc", title: "Vice President", email: "mdudley@ncigc.com", phone: "(952) 881-6123" },
  { firstName: "Neal", lastName: "", companyName: "Nethers Industries", title: "Sales Rep" },
  { firstName: "Neil", lastName: "Green", companyName: "NG Construction", title: "Estimator", phone: "(509) 981-2876" },
  { firstName: "Steve", lastName: "Fleming", companyName: "Noritz", title: "Sales Rep", email: "sfleming@noritz.com", phone: "(206) 778-4626" },
  { firstName: "Eric", lastName: "Cavanaugh", companyName: "Northern Star Construction", title: "Owner", email: "Eric@northernstarcon.com", phone: "(425) 765-4813" },
  { firstName: "Gonzalo", lastName: "", companyName: "Northern Star Construction" },
  { firstName: "Lyndsay", lastName: "Doty", companyName: "Northern Star Construction", email: "Lyndsay@northernstarcon.com", phone: "(425) 760-3764" },
  { firstName: "Sarah", lastName: "Kautz", companyName: "Northern Star Construction", title: "Site Supervisor", phone: "7075290786" },
  { firstName: "Kristian", lastName: "Nunnelee", companyName: "NW Contour", title: "Project Manager", email: "kristian@nwcontour.com", phone: "(206) 498-8555" },
  { firstName: "Stacey", lastName: "Jehlik", companyName: "Obec Brewery", email: "stacey@obecbrewing.com", phone: "(206) 229-5738" },
  { firstName: "Nick", lastName: "Berger", companyName: "Off Ramp Brewery", email: "nick@offrampindustries.com", phone: "(206) 422-9929" },
  { firstName: "Joe", lastName: "Sundberg", companyName: "Old Salt", title: "Owner", email: "joesundberg@gmail.com", phone: "(206) 510-3637" },
  { firstName: "Thomas", lastName: "Mitchell", companyName: "Omni Mechanical", title: "President", email: "tcm@omnimechusa.com", phone: "(425) 443-2093" },
  { firstName: "Robert", lastName: "Beeler", companyName: "Onesta General Contracting", title: "Project Manager", email: "robert@onestallc.com", phone: "(425) 213-6453" },
  { firstName: "Amy Williams", lastName: "", companyName: "Pacific Plumbing Supply", title: "Credit Manager", email: "amyw@pacificplumbing.com", phone: "(206) 762-5950  x4" },
  { firstName: "Finn", lastName: "Fineran", companyName: "Pacific Plumbing Supply", title: "Sales Rep", email: "leonty@pacificplumbing.com", phone: "(206) 763-2470" },
  { firstName: "Jay", lastName: "Montgomery", companyName: "Pacific Plumbing Supply", title: "Sales Rep", email: "JayM@pacificplumbing.com", phone: "(425) 864-3082" },
  { firstName: "Jessica", lastName: "Smith", companyName: "Pacific Plumbing Supply", title: "Commercial Department Manager", email: "jessicas@pacificplumbing.com", phone: "(206) 393-1562" },
  { firstName: "John", lastName: "Kennedy", companyName: "Pacific Plumbing Supply", title: "Sales Rep", email: "johnk@pacificplumbing.com", phone: "(206) 393-1557" },
  { firstName: "Melisa", lastName: "Moen", companyName: "Pacific Plumbing Supply", title: "Sales Rep", email: "Melisam@pacificplumbing.com", phone: "(206) 753-3810" },
  { firstName: "Mike", lastName: "Gardner", companyName: "Pacific Plumbing Supply", title: "Sales Rep", email: "MikeGa@pacificplumbing.com", phone: "(206) 753-3817" },
  { firstName: "Nick", lastName: "Stefonick", companyName: "Pacific Plumbing Supply", title: "Sales Rep", email: "nicks@pacificplumbing.com", phone: "(206) 931-3553" },
  { firstName: "Rachel", lastName: "L. Uhlig", companyName: "Pacific Plumbing Supply", title: "Sales Rep", email: "RachelU@pacificplumbing.com", phone: "(425) 236-9190" },
  { firstName: "Tom", lastName: "Boyer", companyName: "Pacific Plumbing Supply", title: "Sales Rep", email: "TomB@pacificplumbing.com", phone: "(949) 282-8121" },
  { firstName: "Darren", lastName: "Unrue", companyName: "Pacific Rim Inc", email: "darren@pacrim.us", phone: "(425) 750-3441" },
  { firstName: "Brett", lastName: "O'Connor", companyName: "PacWest Sales", title: "Sales Rep", email: "brett@pacwestsalesinc.com", phone: "(206) 391-0926" },
  { firstName: "Gary", lastName: "Yourglich", companyName: "Paramount Supply", title: "Sales Rep", email: "garyyourglich@paramountsupply.com", phone: "(206) 762-1717" },
  { firstName: "Macy", lastName: "", companyName: "Parker Services", title: "Estimator", email: "macy@parkerservices.co" },
  { firstName: "Nate", lastName: "Parker", companyName: "Parker Services", title: "Owner", email: "nate@parkerservices.co", phone: "(206) 458-4129" },
  { firstName: "Jeff", lastName: "Ofelt", companyName: "Percy's", email: "jeffofelt@gmail.com", phone: "(206) 456-9031" },
  { firstName: "Chad", lastName: "Perkins", companyName: "Perkins Excavating", email: "perkinsexcavating@comcast.net", phone: "(425) 788-5550" },
  { firstName: "Mike", lastName: "Bloom", companyName: "Piece of Cake Painting", title: "Owner", email: "pocpainting@gmail.com", phone: "(206) 276-6454" },
  { firstName: "Daniel Crissinger", lastName: "", companyName: "Pike Brewing Company", email: "dcrissinger@pikebrewing.com" },
  { firstName: "Gary Marx", lastName: "", companyName: "Pike Brewing Company", email: "gmarx@pikebrewing.com" },
  { firstName: "Samantha", lastName: "King", companyName: "Pike Brewing Company", title: "General Manager", email: "sking@pikebrewing.com", phone: "(206) 622-6044" },
  { firstName: "John", lastName: "Conway", companyName: "PKC Construction", title: "Estimator", email: "john.conway@pkcc.com", phone: "(913) 782-4646 ext. 564" },
  { firstName: "Travis", lastName: "Post", companyName: "Plenty of Clouds", email: "travis@plentyofclouds.com", phone: "(480) 516-6124" },
  { firstName: "Edward", lastName: "Pierce", companyName: "Plum Level", title: "Estimator", phone: "'+1 (206) 465-2716" },
  { firstName: "Todd", lastName: "Luft", companyName: "Plum Level", title: "Project Manager", phone: "(206) 730-1708" },
  { firstName: "Mario", lastName: "Brockl", companyName: "Plumbing by Mario", phone: "(206) 283-6167" },
  { firstName: "Matthias", lastName: "Scheiblehner", companyName: "PMacgcLLC", title: "Owner", email: "hias.scheib@gmail.com", phone: "(206) 380-5997" },
  { firstName: "Pat", lastName: "MacGregor", companyName: "PMacgcLLC", title: "Project Manager", email: "pmacgc2019@gmail.com", phone: "(253) 297-4285" },
  { firstName: "Greg", lastName: "Ballinger", companyName: "Powell Construction", title: "Project Manager", email: "greg@powellcon.com" },
  { firstName: "Kate", lastName: "Brehm", companyName: "Powell Construction", title: "Project Manager", email: "kateb@powellcon.com", phone: "14258284774" },
  { firstName: "Zach", lastName: "Orr", companyName: "Powell Construction", title: "Project Manager", phone: "4258645559" },
  { firstName: "John", lastName: "John", companyName: "Precision Auto" },
  { firstName: "Kelly", lastName: "Ririe", companyName: "Precision Construction Services", title: "Owner", email: "kellyririe@gmail.com", phone: "(208) 515-6771" },
  { firstName: "Stuart", lastName: "McLeod", companyName: "Precision Construction Services", title: "Owner", email: "leftymcleod@yahoo.com", phone: "(425) 985-0555" },
  { firstName: "Rren", lastName: "Schafer", companyName: "Prem1er", title: "Estimator", email: "RrenS@p1renovations.com", phone: "(206) 900-4730" },
  { firstName: "Molly", lastName: "Lanzinger", companyName: "Premera Health Ins", title: "Sales Rep", email: "mollylanzinger@msn.com", phone: "(425) 681-2402" },
  { firstName: "Jade", lastName: "Stefano", companyName: "Puffin Farms", email: "jades@me.com", phone: "(206) 412-0998" },
  { firstName: "Don Sorensen", lastName: "", companyName: "Puget Sound Energy (PSE)", title: "Project Manager", email: "Don.Sorensen@pse.com", phone: "(206) 771-4246" },
  { firstName: "Eric", lastName: "Thomassian", companyName: "Puget Sound Energy (PSE)", phone: "(206) 348-7001" },
  { firstName: "Erik", lastName: "Bilstad", companyName: "Puget Sound Energy (PSE)", phone: "(425) 213-4286" },
  { firstName: "Jared", lastName: "Lyons", companyName: "Pursuit Building Group", title: "Estimator", email: "jared@pursuitbg.com", phone: "(206) 619-0054" },
  { firstName: "Steven", lastName: "Rainbow", companyName: "Rainbow Consulting", title: "Engineer", email: "steven@rainbowconsulting-me.com", phone: "(206) 235-6002" },
  { firstName: "Chris", lastName: "Peterson", companyName: "Raincap Construction", title: "Project Manager", email: "chris@raincapconstruction.com", phone: "(206) 300-7037" },
  { firstName: "Larry", lastName: "Campbell", companyName: "Raincap Construction", email: "larry@raincapconstruction.com" },
  { firstName: "Amir", lastName: "Razzaghi", companyName: "Razzi Pizza", email: "office@razzis.com", phone: "(206) 799-8907" },
  { firstName: "Zachary", lastName: "", companyName: "\"Rectenwald Brothers Construction", title: "Estimator", email: "zstiefel@rectenwald.com", phone: "1 724-772-8282 ext. 237" },
  { firstName: "Ken", lastName: "Desrosier", companyName: "Redhawk Group", email: "kend@redhawkgroup.com", phone: "(206) 714-4608" },
  { firstName: "Zach", lastName: "Holley", companyName: "Redhawk Group", email: "Zachh@redhawkgroup.com", phone: "(253) 736-5674" },
  { firstName: "Lacey", lastName: "Figueroa", companyName: "Redside Partners LLC", email: "laccey@redsidepartners.com", phone: "(559) 314-5800" },
  { firstName: "Matthew", lastName: "Pontious", companyName: "Refuge Revival", title: "Project Manager", email: "mpontious2@icloud.com", phone: "(206) 719-5549" },
  { firstName: "Molly", lastName: "Mitchell", companyName: "Retail Construction Group INC", title: "Project Engineer", phone: "(425) 202-6842" },
  { firstName: "Kenneth", lastName: "Pritchard", companyName: "Retail Contracting Group", title: "Project Manager", email: "kpritchard@retailcontractinggroup.com", phone: "(612) 284-3731" },
  { firstName: "Ryan", lastName: "Gowans", companyName: "Rhino", title: "Estimator", email: "ryan@rhinoco.biz", phone: "(206) 516-9888" },
  { firstName: "Blake", lastName: "Martin", companyName: "RM Built", title: "Site Supervisor", email: "Blake@rmbuilt.com" },
  { firstName: "William", lastName: "Rafferty", companyName: "RM Built", title: "Project Manager", email: "Will@rmbuilt.com", phone: "(206) 940-8000" },
  { firstName: "Jon", lastName: "Robison", companyName: "Robison Engineering Inc", email: "jrobison@robisonengineering.com", phone: "(206) 384-1976" },
  { firstName: "Mark", lastName: "Manglicmot", companyName: "Robison Engineering Inc", email: "markm@robisonengineering.com", phone: "(360) 420-2744" },
  { firstName: "Mark", lastName: "Robison", companyName: "Robison Engineering Inc", email: "mark@robisonengineering.com", phone: "(206) 954-0353" },
  { firstName: "Paul", lastName: "Robison", companyName: "Robison Engineering Inc", email: "probison@robisonengineering.com", phone: "(206) 601-9564" },
  { firstName: "Graham", lastName: "Barker", companyName: "Rubicon Construction", title: "Estimator", email: "Graham.Barker@Rubicon-construction.com", phone: "(253) 677-2329" },
  { firstName: "Rockwell", lastName: "Ward", companyName: "Rubicon Construction", title: "Estimator", email: "rockwell@rubicon-construction.com" },
  { firstName: "Steve", lastName: "Anderson", companyName: "Rubicon Construction", title: "Estimator", email: "steve@rubicon-construction.com", phone: "(206) 919-1749" },
  { firstName: "Joe", lastName: "Sundberg", companyName: "Rupee", email: "joesundberg@gmail.com", phone: "(206) 510-3637" },
  { firstName: "Marcus", lastName: "Henderson", companyName: "Sawhorse Revolution", email: "marcus@sawhorserevolution.org", phone: "(347) 870-5091" },
  { firstName: "Sarah", lastName: "Smith", companyName: "Sawhorse Revolution", title: "Program Director", email: "sarah@sawhorserevolution.org", phone: "(206) 819-9121" },
  { firstName: "Josh", lastName: "Thomson", companyName: "Schuchart", title: "Estimator", email: "Josh.Thomson@schuchart.com", phone: "(360) 620-9938" },
  { firstName: "Shane", lastName: "Hager", companyName: "SDH Architecture INC", email: "shaneh@sdharch.com", phone: "(425) 891-9529" },
  { firstName: "Donovan", lastName: "McCormick (Donie)", companyName: "Sea Creatures", email: "dmccormick@eatseacreatures.com", phone: "(425) 233-7257" },
  { firstName: "Jeremy", lastName: "Price", companyName: "Sea Creatures", email: "jeremy@eatseacreatures.com", phone: "(206) 697- 0069" },
  { firstName: "Jesse", lastName: "Schumann", companyName: "Sea Wolf Bakery", email: "jesse@seawolfbakers.com" },
  { firstName: "Jim", lastName: "McKenzie", companyName: "Seanet", email: "jimmckenzie@seanet.com", phone: "(206) 423-0428" },
  { firstName: "Vincent", lastName: "LaBelle", companyName: "Seattle Bouldering Project", email: "vincent.labelle@boulderingproject.com", phone: "(206) 981-7813" },
  { firstName: "Cory", lastName: "Sloate", companyName: "Seattle Construction Inc", title: "Estimator", email: "cory@seattleconstructioninc.com", phone: "(206) 282-7500" },
  { firstName: "Ron", lastName: "Rubin", companyName: "Seattle Land Broker", title: "Owner", email: "ron@seattlelandbroker.com", phone: "(206) 973-3022" },
  { firstName: "Lavrens", lastName: "Mathiesen", companyName: "Seattle Mobile Builders LLC", title: "Owner", email: "Lavrans@seattlemobilebuilders.com", phone: "(503) 351-4774" },
  { firstName: "Marcus", lastName: "Luna", companyName: "Shames", title: "Estimator", email: "mluna@shames.com", phone: "(925) 766-6849" },
  { firstName: "Andrew", lastName: "Chrisman", companyName: "SimplyGBC", email: "simplygbc@gmail.com", phone: "(206) 661-3221" },
  { firstName: "Lucas", lastName: "Wilson", companyName: "Sonya's Bar and Grill", phone: "(206) 303-9010" },
  { firstName: "Daniel Lewis", lastName: "", companyName: "Stacy and Witbeck", title: "Estimator", email: "dlewis@stacywitbeck.com", phone: "(480) 438-9601" },
  { firstName: "Steve", lastName: "Drew", companyName: "Stone Drew / Ashe & Jones", email: "STEVE@sdajnw.com", phone: "(206) 763-2850" },
  { firstName: "Jordan", lastName: "Baldwin", companyName: "Stonecraft", email: "jordanb@stonecraftseattle.com", phone: "(206) 769-8062" },
  { firstName: "Scott", lastName: "", companyName: "Stoneway Cafe", phone: "(425) 830-7540" },
  { firstName: "Gavin", lastName: "Rerucha", companyName: "Stout LLC", title: "Estimator", email: "gavinr@stoutllc.com", phone: "(559) 577-7153" },
  { firstName: "Janet", lastName: "Eicher", companyName: "Stumbletown", email: "janeteicher@gmail.com", phone: "(206) 372 - 4520" },
  { firstName: "Heather", lastName: "Mooney", companyName: "Submeter Solutions", email: "heather@submetersolutions.com", phone: "425-228-6831 x210" },
  { firstName: "James Allen", lastName: "", companyName: "Sunbelt Rentals", title: "Territory Account Manager", email: "James.Allen@sunbeltrentals.com", phone: "(206) 375-3797" },
  { firstName: "Kindra", lastName: "Priest", companyName: "Sunbelt Rentals", title: "Sales Rep", email: "kindra.priest@sunbeltrentals.com", phone: "(206) 640-3338" },
  { firstName: "Carmen", lastName: "Brooks", companyName: "Sunset Pacific", title: "Estimator", email: "carmen@sunpac.net" },
  { firstName: "Steve", lastName: "Hathaway", companyName: "SW Hathaway", title: "Estimator", email: "swhathawayinc@gmail.com", phone: "(206) 853-3949" },
  { firstName: "Tia", lastName: "Dahl-Holmes", companyName: "Taylor Boiler & Equipment Co.", title: "Sales Rep", phone: "(503) 285-9800" },
  { firstName: "Tom", lastName: "Taylor", companyName: "Taylor Boiler & Equipment Co.", email: "tom@taylorboiler.com", phone: "(503) 285-9800" },
  { firstName: "Barry", lastName: "Brown", title: "Project Manager", email: "barry@acgbuilds.com", phone: "1206-962-7123" },
  { firstName: "Bill", lastName: "Leonard", email: "1bonanza@comcast.net", phone: "(206) 850-7524" },
  { firstName: "Dan", lastName: "Zarelli", title: "Estimator", email: "dan@levelcontracting.com" },
  { firstName: "Flynn", lastName: "Wienker", title: "Project Manager", email: "flynn@chaincos.com", phone: "206-963-7126" },
  { firstName: "Jeff", lastName: "Taipale", title: "Site Supervisor", email: "jeff@metisconstructioninc.com", phone: "(206) 920-9242" },
  { firstName: "Ken", lastName: "Johnson", phone: "(425) 268-0515" },
  { firstName: "Kevin", lastName: "Bay", title: "Site Supervisor", email: "kbay@methodconstruction.com" },
  { firstName: "Kevin", lastName: "Lomas", title: "Site Supervisor", phone: "8087566434" },
  { firstName: "Michael", lastName: "Euzent", title: "Site Supervisor", email: "Michael@methodconstruction.com", phone: "4085055386" },
  { firstName: "Phil", lastName: "Showstead", title: "Site Supervisor", email: "philip.metis@gmail.com", phone: "(425) 218-2489" },
  { firstName: "Rachel", lastName: "Brendle", phone: "(540) 798-9906" },
  { firstName: "Tara", lastName: "Young", title: "Site Supervisor", email: "tara@methodconstruction.com", phone: "(206) 310-0527" },
  { firstName: "Tina", lastName: "Song", title: "Project Manager", email: "tina@methodconstruction.com", phone: "(360) 633-5053" },
  { firstName: "Todd", lastName: "Maschemedt", title: "Site Supervisor", email: "todd@methodconstruction.com", phone: "(360) 951-5692" },
  { firstName: "Ty", lastName: "Baldi", title: "Sales Rep", email: "tyb@pacificplumbing.com", phone: "(206) 953-4139" },
  { firstName: "Hassan", lastName: "Fahmy", companyName: "TEEL Construction", title: "Estimator", email: "hfahmy@teelconstruction.com", phone: "703-759-4754 ext. 238" },
  { firstName: "Ranee", lastName: "Lippens", companyName: "Twin Shores", title: "Estimator", email: "rlippens@twin-shores.com", phone: "(563) 579-2481" },
  { firstName: "Scott", lastName: "Staples", companyName: "Uneeda Burger", email: "ssrmco@gmail.com", phone: "(206) 271-9889" },
  { firstName: "Greg", lastName: "Scheaffer", companyName: "Union", email: "manager@unionseattle.com", phone: "(206) 792-6814" },
  { firstName: "Joe", lastName: "Cannon", companyName: "Union", email: "joe@cannoncommercial.com", phone: "(206) 478-6997" },
  { firstName: "Major", lastName: "Wolfe", companyName: "VCC USA", title: "Estimator", email: "mwolfe@vccusa.com", phone: "(214) 949-6785" },
  { firstName: "Rami", lastName: "Alley", companyName: "VCC USA", title: "Project Manager", email: "ralley@vccusa.com", phone: "(501) 680-3859" },
  { firstName: "John", lastName: "Kessel", companyName: "Viega", title: "Sales Rep", email: "john.kessel@viega.us", phone: "(208) 407-4689" },
  { firstName: "Tyler", lastName: "Akers", companyName: "Viega", title: "Sales Rep", email: "Tyler.Akers@Viega.us", phone: "(425) 306-6980" },
  { firstName: "Michelle", lastName: "Dysinger", companyName: "Viking Construction", title: "Estimator", email: "mdysinger@vikingcg.net", phone: "(425) 286-8131" },
  { firstName: "Scott", lastName: "Larson", companyName: "Viking Construction", title: "Estimator", email: "Lars@vikingcg.net", phone: "(425) 286-8131 (Office)" },
  { firstName: "Ben", lastName: "Quintanar", companyName: "Walefins Construction", title: "Site Supervisor", email: "ben.quintanar@walefins.com", phone: "(206) 900-4701" },
  { firstName: "Cameron", lastName: "Lakeman", companyName: "Walefins Construction", title: "Project Manager", email: "cameron@walefins.com", phone: "(425) 606-8054" },
  { firstName: "Conner", lastName: "Simmons", companyName: "Walefins Construction", title: "Accounting", email: "connor.simmons@walefins.com", phone: "(253) 298-7743" },
  { firstName: "Garrett", lastName: "Lessing", companyName: "Walefins Construction", title: "Site Supervisor", email: "garrett.lessing@walefins.com", phone: "(206) 635-5197" },
  { firstName: "Jason", lastName: "Wynecoop", companyName: "Walefins Construction", title: "Office", email: "jason@walefins.com", phone: "(206) 605-1134" },
  { firstName: "John", lastName: "Parks", companyName: "Walefins Construction", title: "Project Manager", email: "john.parks@walefins.com", phone: "(206) 472-4068" },
  { firstName: "Leon", lastName: "Van Pevenage", companyName: "Walefins Construction", title: "Site Supervisor", email: "leon.vanpevenage@walefins.com", phone: "(253) 686-2071" },
  { firstName: "Pat", lastName: "Alejandro", companyName: "Walefins Construction", title: "Office", email: "pat@walefins.com", phone: "(206) 696-1284" },
  { firstName: "Victor", lastName: "Garcia", companyName: "Walefins Construction", email: "victor.garcia@walefins.com", phone: "(253) 341-2145" },
  { firstName: "Jonathan", lastName: "Martin", companyName: "Washington State Department of Enterprise Services", email: "jonathan.martin@des.wa.gov", phone: "(360) 239-3350" },
  { firstName: "Derek", lastName: "Hall", companyName: "Waste Management", title: "Route Manager", phone: "(206) 962-7732" },
  { firstName: "Sue", lastName: "Kelly", companyName: "Waste Management", title: "Office Admin", email: "skelly1@wm.com" },
  { firstName: "Molly", lastName: "Hawkins", companyName: "We Are Unicorns", email: "molly@weareunicorns.co", phone: "(360) 798-9325" },
  { firstName: "Kelly", lastName: "Ririe", companyName: "Webb Building LLC", title: "Owner", email: "kellyririe@gmail.com", phone: "(208) 515-6771" },
  { firstName: "Zach", lastName: "Wentzel", companyName: "Wentzel Building", title: "Estimator", email: "zach@wentzelbuilding.com", phone: "(425) 275-7168" },
  { firstName: "Pedro", lastName: "Vergara", companyName: "Western Insulation", email: "westerninsulation@hotmail.com", phone: "(253) 486-6585" },
  { firstName: "Andrey", lastName: "Storozhev", companyName: "Wilcox", title: "Site Supervizor", email: "andrey@wilcoxconstruction.com", phone: "(206) 817-2904" },
  { firstName: "Boyd", lastName: "McPherson", companyName: "Wilcox", title: "Site Supervisor", email: "bmcpherson@wilcoxconstruction.com", phone: "(206) 595-9330" },
  { firstName: "Casey", lastName: "Vallee", companyName: "Wilcox", title: "Estimator", email: "bids@wilcoxconstruction.com", phone: "(206) 920-1071" },
  { firstName: "David", lastName: "Evangelisto", companyName: "Wilcox", title: "Project Manager", email: "Devangelisto@wilcoxconstruction.com", phone: "(253) 376-3978" },
  { firstName: "Ian", lastName: "Mayther", companyName: "Wilcox", title: "Project Engineer", email: "imayther@wilcoxconstruction.com", phone: "(206) 909-1920" },
  { firstName: "Jim", lastName: "Bray", companyName: "Wilcox", title: "Project Manager", email: "jbray@wilcoxconstruction.com", phone: "(206) 537-2359" },
  { firstName: "Kirt", lastName: "Jones", companyName: "Wilcox", title: "Site Supervisor", email: "kjones@wilcoxconstruction.com", phone: "(206) 817-2504" },
  { firstName: "Matt", lastName: "Wilcox", companyName: "Wilcox", title: "Project Manager", email: "mwilcox@wilcoxconstruction.com", phone: "(206) 530-1342" },
  { firstName: "Paul", lastName: "Carter", companyName: "Wilcox", title: "Estimator", email: "pcarter@wilcoxconstruction.com", phone: "(206) 817-1254" },
  { firstName: "Wilcox", lastName: "Office", companyName: "Wilcox", title: "Estimator", email: "bids@wilcoxconstruction.com", phone: "14257744185" },
  { firstName: "Antonio", lastName: "", companyName: "Wolf Skill Construction", title: "Owner", email: "antonio@wolfskillconstruction.com", phone: "(206) 473-2811" },
  { firstName: "Brian", lastName: "Wigen", companyName: "Woodman", title: "Site Supervisor", email: "brianw@woodmanconstruction.com", phone: "(425) 417-3704" },
  { firstName: "Joe", lastName: "McLaughlin", companyName: "Woodman", title: "Project Manager", email: "joe@woodmanconstruction.com", phone: "(425) 454-3621" },
  { firstName: "Mike", lastName: "Browne", companyName: "Woodman", title: "Estimator", email: "michaelb@woodmanconstruction.com", phone: "4254170323" },
  { firstName: "Monica", lastName: "Wagner", companyName: "Woodman", title: "Office Admin", email: "monica@woodmanconstruction.com" },
  { firstName: "Stefanie", lastName: "Ciolkosz", companyName: "Woodman", title: "Office Admin", email: "Stefanie@woodmanconstruction.com", phone: "(425) 454-3621" },
  { firstName: "Sue", lastName: "Shangguan", companyName: "Woodman", title: "Office Admin", email: "sue@woodmanconstruction.com", phone: "(425) 454-3621" },
];

// ---------------------------------------------------------------------------
// Employees — Parker Services internal staff (separate from external contacts)
// ---------------------------------------------------------------------------

type RawEmployee = {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;         // company email
  emailPersonal?: string;
  role?: string;          // primary role (Apprentice / Journeyman / Owner / Admin / BookKeeper)
  homeAddress?: string;
  partnerName?: string;
  partnerPhone?: string;
  partnerEmail?: string;
  emergencyContact1?: string;
  emergency1Phone?: string;
  emergencyContact2?: string;
  emergency2Phone?: string;
  status?: string;
  birthday?: string;      // YYYY-MM-DD
  hireDate?: string;      // YYYY-MM-DD
  licenseId?: string;
  licPlumbing?: string;
  expPlumbing?: string;   // YYYY-MM-DD
  licScissorLift?: string; // YYYY-MM-DD
  expGas?: string;        // YYYY-MM-DD
  licGas?: string;
  deviceNumber?: string;
};

const AIRTABLE_EMPLOYEES: RawEmployee[] = [
  {
    firstName: "Enrique",
    lastName: "Hernandez-Castro",
    phone: "(253) 325-8835",
    email: "enrique@parkerservices.co",
    emailPersonal: "hernandeze552@yahoo.com",
    role: "Apprentice",
    homeAddress: "16109 4th Avenue S, Spanaway, WA 98387",
    emergencyContact1: "Raymundo Hernandez",
    emergency1Phone: "(253) 202-3460",
    emergencyContact2: "Allyssa O'Neal",
    emergency2Phone: "(253) 325-8834",
    status: "Employed",
    birthday: "1999-01-13",
    hireDate: "2025-03-17",
    licenseId: "Trainee-HERNAE*781O1",
    licPlumbing: "HERNAE*781O1",
    expPlumbing: "2025-09-21",
    licScissorLift: "2025-03-17",
  },
  {
    firstName: "David",
    lastName: "Berckman",
    phone: "(610) 757-8712",
    email: "david@parkerservices.co",
    emailPersonal: "berckman.david@gmail.com",
    role: "Apprentice",
    homeAddress: "13550 NE Village Square Dr Apt H412, Woodinville, WA 98072",
    emergencyContact1: "Dave Berckman",
    emergency1Phone: "(484) 684-4592",
    status: "Employed",
    birthday: "1998-09-02",
    hireDate: "2025-03-18",
    licenseId: "Trainee-BerckDF755CL",
    licPlumbing: "BerckDF755CL",
    expPlumbing: "2026-02-13",
    licScissorLift: "2025-03-16",
  },
  {
    firstName: "Josh",
    lastName: "Rossi",
    phone: "(831) 747-7714",
    email: "josh@parkerservices.co",
    emailPersonal: "josh.rossi@protonmail.com",
    role: "Journeyman",
    homeAddress: "8510 30th St E, Edgewood, WA 98371",
    partnerName: "Melinda Rossi",
    emergencyContact1: "Melinda Rossi (spouse)",
    emergency1Phone: "(509) 990-9706",
    emergencyContact2: "Christopher Rossi (father)",
    emergency2Phone: "(509) 990-9706",
    status: "Employed",
    birthday: "1981-10-23",
    hireDate: "2018-08-14",
    licenseId: "PL01-Commercial-ROSSIJA883TM",
    licPlumbing: "ROSSIJA883TM",
    expPlumbing: "2025-10-23",
    licScissorLift: "2023-01-27",
  },
  {
    firstName: "Jameson",
    lastName: "Gentry",
    phone: "(720) 376-1646",
    email: "jameson@parkerservices.co",
    emailPersonal: "jamesongentry39@gmail.com",
    role: "Journeyman",
    homeAddress: "9006 174th Street Court",
    emergencyContact1: "Tatum Lombardi",
    emergency1Phone: "(303) 264-4520",
    status: "Employed",
    birthday: "2000-11-15",
    hireDate: "2024-12-10",
    licenseId: "PL01-Commercial-GENTRJR774M7",
    licPlumbing: "GENTRJR774M7",
    expPlumbing: "2026-11-15",
    licScissorLift: "2025-02-06",
  },
  {
    firstName: "Nate",
    lastName: "Parker",
    phone: "(206) 458-4129",
    email: "nate@parkerservices.co",
    emailPersonal: "nathanjparker@gmail.com",
    role: "Owner",
    homeAddress: "7337 Earl Ave NW, Seattle, WA 98117",
    partnerName: "Sarah Parker",
    partnerPhone: "(360) 301-5025",
    emergencyContact1: "Janice Weinhold (mother)",
    emergency1Phone: "(206) 919-7788",
    emergencyContact2: "Kaycee Parker (sibling)",
    emergency2Phone: "(206) 919-7788",
    status: "Employed",
    birthday: "1977-03-18",
    hireDate: "2014-01-01",
    licenseId: "PL01-Commercial-PARKENJ834C8",
    licPlumbing: "PARKENJ834C8",
    expPlumbing: "2027-03-18",
    expGas: "2024-03-31",
    licGas: "LIC-GP-1077",
    deviceNumber: "(206) 485-8312",
  },
  {
    firstName: "Sarah",
    lastName: "Parker",
    phone: "(360) 301-5025",
    email: "sarah@parkerservices.co",
    emailPersonal: "skoparker@gmail.com",
    role: "Owner",
    homeAddress: "7337 Earl Ave NW, Seattle, WA 98117",
    partnerName: "Nate Parker",
    partnerPhone: "(206) 458-4129",
    emergencyContact1: "Irma O'Brien (mother)",
    status: "Employed",
    birthday: "1976-02-13",
    hireDate: "2015-04-01",
  },
  {
    firstName: "Brittany",
    lastName: "Barnum",
    phone: "(480) 452-8521",
    email: "ea@parkerservices.co",
    emailPersonal: "brittanynlongfield@gmail.com",
    role: "Admin",
    homeAddress: "7521 S Woodchute Dr, Gold Canyon, AZ 85118",
    partnerName: "Brandon Barnum",
    partnerPhone: "(602) 999-5719",
    status: "Employed",
    hireDate: "2025-12-10",
  },
  {
    firstName: "Kristen",
    lastName: "Frame",
    phone: "(206) 491-2268",
    email: "accounting@parkerservices.co",
    emailPersonal: "2keaston@gmail.com",
    role: "BookKeeper",
    homeAddress: "22802 60th Ave W, Mountlake Terrace, WA 98043",
    partnerName: "Woody Frame",
    partnerPhone: "(425) 510-8077",
    partnerEmail: "woody064@gmail.com",
    status: "Employed",
    birthday: "1979-12-09",
    hireDate: "2024-04-16",
  },
];

type RawJurisdiction = {
  name: string;
  state?: string;
  phone?: string;
  inspectionPhone?: string;
  address?: string;
  website?: string;
  notes?: string;
  contactNames?: string;
};

const AIRTABLE_JURISDICTIONS: RawJurisdiction[] = [
  {
    name: "Auburn",
    state: "WA",
    phone: "(253) 931-3020",
    address: "25 W Main St, Auburn, WA 98001",
  },
  {
    name: "Bellevue",
    state: "WA",
    contactNames: "Bob Heavey, Mark Muld",
  },
  {
    name: "City of Kent",
    state: "WA",
    phone: "(253) 856-5412",
    website: "https://www.kentwa.gov/pay-and-apply/apply-for-a-permit/electronic-permit-applications",
  },
  {
    name: "Covington",
    state: "WA",
    phone: "(253) 480-2400",
    address: "16720 SE 271st Street, Suite 100, Covington, WA 98042",
    website: "https://www.covingtonwa.gov/city_departments/communitydevelopment/permitservices/index.php",
    contactNames: "Kelly Thompson",
    notes: "Hours: Monday–Friday 8am–5pm",
  },
  {
    name: "Des Moines",
    state: "WA",
    phone: "(206) 870-7576",
    inspectionPhone: "(206) 870-6531",
    address: "21630 11th Ave S, Suite A, Des Moines, WA 98198",
    website: "https://www.desmoineswa.gov/",
    contactNames: "Ryan Niemi",
  },
  {
    name: "Duvall",
    state: "WA",
    website: "https://www.duvallwa.gov/424/Permitting",
    contactNames: "Melanie Young",
  },
  {
    name: "Everett",
    state: "WA",
    phone: "(425) 754-4262",
    address: "12425 Meridian Ave. S, Everett, WA 98208",
    contactNames: "Karl Fitterer",
    notes: "Deputy Chief of Community Protection. Fire sprinkler/alarm changes overseen by South County Fire District.",
  },
  {
    name: "Federal Way",
    state: "WA",
    phone: "(253) 835-2607",
    inspectionPhone: "(253) 835-3050",
    website: "https://www.cityoffederalway.com/node/1351",
  },
  {
    name: "Issaquah",
    state: "WA",
  },
  {
    name: "Kenmore",
    state: "WA",
  },
  {
    name: "King County Assessor Office",
    state: "WA",
    phone: "(206) 296-7300",
    website: "https://kingcounty.gov/depts/assessor/Contact-Us.aspx",
    notes: "Email: Assessor.Info@KingCounty.Gov",
  },
  {
    name: "Kirkland",
    state: "WA",
    phone: "(425) 587-3600",
    website: "https://www.kirklandwa.gov/files/sharedassets/public/development-services/pdfs/building-fees-2023.pdf",
    contactNames: "Justin Hauley",
    notes: "Must be logged OUT of our account to schedule inspections. Can schedule up to 5 days out. Inspection windows: 8:30am–12pm or 12:30–3pm.",
  },
  {
    name: "Lynnwood",
    state: "WA",
    phone: "(425) 670-5400",
    website: "https://www.lynnwoodwa.gov/Services/",
  },
  {
    name: "Maple Valley",
    state: "WA",
    phone: "(425) 413-8800",
    inspectionPhone: "(425) 413-5077",
    address: "22017 SE Wax Road, Suite 200, Maple Valley, WA 98038",
    contactNames: "Deb Yankeh",
    notes: "Inspection requests by email: communitydevelopment@maplevalleywa.gov. Include permit #, address, contact name/phone, inspection type, and preferred AM/PM.",
  },
  {
    name: "Mill Creek",
    state: "WA",
    phone: "(425) 551-7254",
    website: "https://mybuildingpermit.com",
    contactNames: "Andreea Badiu, Mike Kolakowski, Bobby Thomas",
    notes: "Permits via mybuildingpermit.com. Email: permitcounter@millcreekwa.gov",
  },
  {
    name: "Olympia",
    state: "WA",
    phone: "(360) 753-8314",
    website: "https://ci-olympia-wa.smartgovcommunity.com/Public/Home",
    notes: "Must call for final 48 hours prior to inspection. Ask for Louise Rosario.",
  },
  {
    name: "Pierce County",
    state: "WA",
    website: "https://pals.piercecountywa.gov/palsonline/#/dashboard",
  },
  {
    name: "Redmond",
    state: "WA",
    phone: "(425) 556-2673",
    address: "15670 NE 85th Street, 2nd Floor, Redmond, WA 98052",
    website: "https://www.redmond.gov",
    contactNames: "Bruce Brown, Teri Tupper",
    notes: "Request inspections online. Add contact name/number in notes. 2-hour prior notice call required. They may call 10 min before arrival.",
  },
  {
    name: "Renton",
    state: "WA",
    phone: "(425) 902-7572",
    website: "https://permitting.rentonwa.gov",
    contactNames: "Scott Mitchell, Michael George",
  },
  {
    name: "Seattle Boiler",
    state: "WA",
    phone: "(206) 263-9566",
    website: "https://cosaccela.seattle.gov/portal/Customization/SEATTLE/Welcome.aspx",
    contactNames: "Steve Frazier, Brian Hippie",
  },
  {
    name: "Seattle King County (Inspectors)",
    state: "WA",
    phone: "(206) 205-0935",
    address: "401 5th Ave, Suite 1100, Seattle, WA 98104",
    website: "https://kingcounty.gov/depts/health/environmental-health/piping/plumbing.aspx",
    contactNames: "Randall Bray, Dan Roberson, Tracy Belvill, Tom Haynes, Doug Harris, Larry Callahan, David Cheeseman, Rick Lewis, Eric Gilbreth, Scott Entsminger, Nathan Isaacson, Dan Osborne, Carlos Barrientes",
    notes: "Hours: Mon/Wed/Fri 8am–3pm, Tue/Thu 10:30am–3pm. Automated line: (206) 205-0935. Have callback number ready. Wait for 'Inspection has been scheduled'.",
  },
  {
    name: "Seattle King County (Reviewers)",
    state: "WA",
    phone: "(206) 205-0935",
    address: "401 5th Ave, Suite 1100, Seattle, WA 98104",
    contactNames: "Mike Ballou, Patty Sjolin, Sandy Harpreet, Steve Hart, Eric Gilbreath, Alan Czarnecki, Ian McLaughlin, Renee Tautua, Dave Price, Todd Bradbury",
    notes: "Hours: Mon/Wed/Fri 8am–3pm, Tue/Thu 10:30am–3pm.",
  },
  {
    name: "Seattle King County (Permit Issues)",
    state: "WA",
    phone: "(206) 263-9566",
    contactNames: "Renee Tautua",
    notes: "Email: rtautua@kingcounty.gov",
  },
  {
    name: "Seattle Public Utilities",
    state: "WA",
    address: "401 5th Ave, Suite 1100, Seattle, WA 98104",
    contactNames: "Angelique Hockett",
  },
  {
    name: "Shoreline",
    state: "WA",
    contactNames: "Ray Allshouse",
  },
  {
    name: "Tacoma",
    state: "WA",
    phone: "(253) 591-5030",
    website: "https://www.cityoftacoma.org/cms/One.aspx?portalId=169&pageId=22941",
    contactNames: "Joel Rasmussen",
  },
  {
    name: "Thurston County",
    state: "WA",
    phone: "(360) 786-5490",
    inspectionPhone: "(360) 786-5489",
    address: "3000 Pacific Ave SE, Suite 100, Olympia, WA 98501",
    notes: "Appointments required for non-residential permit applications. Call Commercial Plans Examiner at (360) 786-5466. Schedule inspections 1–3 days in advance. Results available same-day if inspection done by 3pm.",
  },
  {
    name: "Tukwila",
    state: "WA",
    phone: "(206) 431-3670",
    website: "https://www.tukwilawa.gov/departments/permit-center/",
  },
];

type RawJob = {
  jobName: string;
  projectPhase: string;
  gcName?: string;
  siteAddress?: string;
  siteCity?: string;
  siteState?: string;
  siteZip?: string;
  originalContractValue?: number;
  notes?: string; // combined notes → activity entry
};

const AIRTABLE_JOBS: RawJob[] = [
  {
    jobName: "81 Vine St (Olsen Resi)",
    projectPhase: "Active",
    gcName: "Chain Construction",
    siteAddress: "81 Vine St",
    siteCity: "Seattle",
    siteState: "WA",
  },
  {
    jobName: "Cherry Street Farms (HHIG)",
    projectPhase: "Active",
    gcName: "Sawhorse Revolution",
    siteAddress: "1911 E Cherry St",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98122",
  },
  {
    jobName: "Circle Wellness",
    projectPhase: "Active",
    gcName: "Dovetail",
    siteAddress: "1326 N Northlake Way",
    siteCity: "Seattle",
    siteState: "WA",
  },
  {
    jobName: "Death & Co",
    projectPhase: "Active",
    gcName: "Wilcox",
    siteAddress: "419 Occidental Ave S",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98104",
    originalContractValue: 315352.59,
  },
  {
    jobName: "FS8 Dexter",
    projectPhase: "Active",
    gcName: "Jalen WA LLC",
    siteAddress: "700 Dexter Ave N",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98109",
    originalContractValue: 61000,
  },
  {
    jobName: "Good Mart",
    projectPhase: "Active",
    gcName: "Dovetail",
    siteAddress: "5130 Ballard Ave NW",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98107",
  },
  {
    jobName: "Graduate Hotel 3",
    projectPhase: "Active",
    gcName: "Metis Construction",
    siteAddress: "4507 Brooklyn Ave NE",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98105",
    originalContractValue: 75275.65,
  },
  {
    jobName: "Insignia Towers",
    projectPhase: "Awarded",
    gcName: "Driftwood",
    siteAddress: "583 Battery St",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98121",
  },
  {
    jobName: "Miro Tea House",
    projectPhase: "Active",
    gcName: "Dolan Build",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98104",
    originalContractValue: 35985.39,
  },
  {
    jobName: "Shane Robinson (OliveST)",
    projectPhase: "Active",
    siteAddress: "2814 E Olive St",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98122",
  },
  {
    jobName: "Shawn O'Donells",
    projectPhase: "Active",
    siteAddress: "508 2nd Ave",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98104",
  },
  {
    jobName: "Stevie's Famous",
    projectPhase: "Active",
    gcName: "BMDC",
    siteAddress: "6000 Phinney Ave N",
    siteCity: "Seattle",
    siteState: "WA",
    originalContractValue: 106000,
  },
  {
    jobName: "T&C Pavillion",
    projectPhase: "Active",
    gcName: "Mallet",
    siteAddress: "1420 NW 56th St",
    siteCity: "Seattle",
    siteState: "WA",
    siteZip: "98107",
  },
];

type RawCompany = {
  name: string;
  type: "GC" | "Sub" | "Vendor" | "Owner" | "Other";
  phone?: string;
  address?: string;
  website?: string;
};

// Airtable type mapping: Contractor→GC, Subcontractor/Backflow/Insulation→Sub,
// Vendor/Truck Service→Vendor, Customer→Owner, everything else→Other
const AIRTABLE_COMPANIES: RawCompany[] = [
  // ── GC / Contractors ──────────────────────────────────────────────────────
  { name: "Abbott Construction", type: "GC" },
  { name: "ACG", type: "GC" },
  { name: "Alegis", type: "GC" },
  { name: "Always Downtown / Promondo", type: "GC" },
  { name: "Andrews Group (The)", type: "GC" },
  { name: "Angell Construction", type: "GC" },
  { name: "Anytime CR (ACR)", type: "GC" },
  { name: "Avara Construction", type: "GC", address: "15333 NE 90th St, Suite S, Redmond, WA 98052", phone: "(206) 365-4440", website: "https://www.avaraconstruction.com/contact" },
  { name: "Avid Build", type: "GC" },
  { name: "Axiom", type: "GC", phone: "(206) 637-1701", website: "https://axiomdesignbuild.com" },
  { name: "Baird Designs", type: "GC" },
  { name: "BCI National Construction and Facilities", type: "GC" },
  { name: "Beauchamp", type: "GC" },
  { name: "BKB", type: "GC", address: "22325 Marine View Dr S, Des Moines, WA 98198", phone: "(206) 679-3370" },
  { name: "Black Rock Industries", type: "GC", address: "1106 39th Ave SE, Puyallup, WA 98374", phone: "(253) 735-7172", website: "https://blackrockind.com/" },
  { name: "Blue Sound Construction, Inc.", type: "GC" },
  { name: "BMDC", type: "GC", address: "2600 W. Commodore Way, Suite 2, Seattle, WA 98199", phone: "(206) 588-0698", website: "https://www.belottimchugh.com/" },
  { name: "BNBuilders", type: "GC", address: "2601 Fourth Avenue, Suite 350, Seattle, WA 98121", phone: "(206) 382-3443", website: "https://www.bnbuilders.com/" },
  { name: "Bodhi", type: "GC" },
  { name: "Boundless Construction Co", type: "GC" },
  { name: "Bright Street Construction", type: "GC" },
  { name: "Brightwork", type: "GC" },
  { name: "Brother builders", type: "GC" },
  { name: "Build Group", type: "GC" },
  { name: "Canright", type: "GC" },
  { name: "Capitol Hill Construction", type: "GC" },
  { name: "Cardinal", type: "GC" },
  { name: "Chain Construction", type: "GC", address: "323 1st Ave W, Seattle, WA 98119", phone: "(206) 424-5464", website: "https://www.chaincos.com/" },
  { name: "Clark Construction Group", type: "GC", website: "https://www.clarkconstruction.com" },
  { name: "Clark Construction Inc", type: "GC", address: "901 Hildebrand Lane, Bainbridge Island, WA 98110", phone: "(206) 842-5450", website: "https://clarkconstruct.com/" },
  { name: "Coastal Construction", type: "GC" },
  { name: "Cobalt Construction", type: "GC" },
  { name: "Colbear Group", type: "GC", address: "1560 Broadway, Ste H, Santa Monica, CA 90405", phone: "(858) 736-1770", website: "http://www.colbeargroup.com/" },
  { name: "Colvos", type: "GC" },
  { name: "Constructive Energy", type: "GC" },
  { name: "Copacetic, LLC", type: "GC", phone: "(512) 694-0866" },
  { name: "Cornerstone", type: "GC" },
  { name: "CORstone", type: "GC" },
  { name: "CPM Tenant Improvement Solutions", type: "GC", address: "1509 Bonneville Ave, Snohomish, WA 98290", phone: "(360) 863-6705", website: "https://cpmnw.com/" },
  { name: "Crescent Builds", type: "GC" },
  { name: "CRW Building", type: "GC" },
  { name: "CSI", type: "GC" },
  { name: "Dallas Commercial Builders", type: "GC" },
  { name: "Deacon", type: "GC", address: "8343 154th Avenue NE, Redmond, WA 98052" },
  { name: "Dempsey", type: "GC" },
  { name: "DH Pace Door Services Group", type: "GC" },
  { name: "Dolan Build", type: "GC", address: "4233 21st Ave W, Seattle, WA 98199", phone: "(206) 743-1095", website: "https://www.dolangc.com/" },
  { name: "Dovetail", type: "GC", address: "1143 NW 45th St, Suite A, Seattle, WA 98107", phone: "(206) 545-0722", website: "https://www.dovetailgc.com/" },
  { name: "DPI", type: "GC" },
  { name: "Driftwood", type: "GC" },
  { name: "Dyna Builders", type: "GC" },
  { name: "Empire Construction", type: "GC" },
  { name: "Evolution Projects", type: "GC" },
  { name: "Falcon Construction", type: "GC" },
  { name: "FarWest", type: "GC" },
  { name: "Ferguson Construction", type: "GC", address: "13810 SE Eastgate Way #110, Bellevue, WA 98005", phone: "(425) 974-8400" },
  { name: "FORMA Construction", type: "GC" },
  { name: "Fradkin Fine Construction", type: "GC" },
  { name: "Fulcrum", type: "GC" },
  { name: "Fuller Living Const.", type: "GC" },
  { name: "Gaspars", type: "GC", address: "300 S. Lucile St., Seattle, WA 98108", phone: "(206) 324-8199", website: "https://gaspars.com" },
  { name: "GenCap", type: "GC", address: "5808 Lake Washington Blvd NE, Suite 203, Kirkland, WA 98033", phone: "(425) 242-1439", website: "https://gencapgc.com/" },
  { name: "Goudy", type: "GC" },
  { name: "Gray West Inc", type: "GC" },
  { name: "Hammer & Hand", type: "GC" },
  { name: "Harco Construction", type: "GC" },
  { name: "Hazel point", type: "GC" },
  { name: "Hilber's Inc", type: "GC" },
  { name: "Hilliard Construction", type: "GC", address: "9814 34th Ave SW, Seattle, WA 98126", phone: "(310) 955-8687" },
  { name: "Horizon", type: "GC" },
  { name: "Howard S. Wright", type: "GC", address: "415 1st Avenue North, Seattle, WA 98109", website: "https://www.balfourbeattyus.com" },
  { name: "ICG Interstate Construction Group", type: "GC" },
  { name: "InterServ LP", type: "GC" },
  { name: "Irons Brothers Construction", type: "GC" },
  { name: "JAG Building Group", type: "GC", website: "http://www.jagbuilding.com/" },
  { name: "Jalen WA LLC", type: "GC" },
  { name: "James Co / Northern Star Construction", type: "GC", address: "154 Village Court, Suite 100, Monroe, WA 98272", phone: "(425) 765-4813" },
  { name: "James E. John Construction Co., Inc.", type: "GC", address: "1701 SE Columbia River Dr, Vancouver, WA 98661", phone: "(360) 696-0837", website: "https://www.jamesjohnconstruction.com" },
  { name: "Jason Manges", type: "GC" },
  { name: "JCI", type: "GC" },
  { name: "JM Riley", type: "GC", address: "1200 Whitman Ct NE, Renton, WA 98059", phone: "(425) 786-9292", website: "https://jmrileyco.com/" },
  { name: "Joe Sundberg", type: "GC", phone: "(206) 510-3637" },
  { name: "JTM", type: "GC", address: "5900 Airport Way South, Suite 110, Seattle, WA 98108", phone: "(206) 587-4000", website: "https://jtmconstruction.com/" },
  { name: "King Construction", type: "GC" },
  { name: "Lindstrom Company LLC", type: "GC", address: "350 SE Bush St, Issaquah, WA 98027", phone: "(206) 948-1217" },
  { name: "Mallet", type: "GC", address: "2700 4th Ave S, Suite D, Seattle, WA 98134" },
  { name: "Mavacon", type: "GC" },
  { name: "Method Construction", type: "GC", address: "2442 NW Market St, #182, Seattle, WA 98107", phone: "(206) 250-2427", website: "http://www.methodconstruction.com/" },
  { name: "Metis Construction", type: "GC", address: "941 S Nebraska St, Seattle, WA 98108", phone: "(206) 356-4544", website: "https://www.metisconstructioninc.com/" },
  { name: "Metropolitan", type: "GC" },
  { name: "MGAC", type: "GC", phone: "(425) 739-1357", website: "https://www.mgac.com" },
  { name: "Model Restaurant Group", type: "GC" },
  { name: "Monumental", type: "GC" },
  { name: "Morita Bauer Construction", type: "GC", address: "6523 California Ave SW, Seattle, WA 98136", phone: "(206) 222-9982" },
  { name: "National Contractors Inc", type: "GC" },
  { name: "NG Construction", type: "GC" },
  { name: "Northern Star Construction", type: "GC", address: "154 Village Court, Suite 100, Monroe, WA 98272", phone: "(425) 765-4813" },
  { name: "Norwood PNW", type: "GC", phone: "(206) 369-8673" },
  { name: "NW Contour", type: "GC" },
  { name: "Onesta General Contracting", type: "GC" },
  { name: "Parker Services", type: "GC", address: "2400 NW 80th St #137, Seattle, WA 98117", phone: "(206) 458-4129" },
  { name: "Piece of Cake Painting", type: "GC", phone: "(206) 383-1553", website: "https://pieceofcakepainting.com/" },
  { name: "PKC Construction", type: "GC" },
  { name: "Plum Level", type: "GC" },
  { name: "PMacgcLLC", type: "GC" },
  { name: "Powell Construction", type: "GC" },
  { name: "Precision Construction Services", type: "GC" },
  { name: "Prem1er", type: "GC", address: "223 S. Lewis Street, Monroe, WA 98272", phone: "(360) 217-8212", website: "https://www.p1renovations.com" },
  { name: "Pursuit Building Group", type: "GC" },
  { name: "Raincap Construction", type: "GC", phone: "(206) 330-7037", website: "https://raincapconstruction.com" },
  { name: "Rectenwald Brothers Construction, Inc.", type: "GC", address: "17 Leonberg Rd, Suite 200, Cranberry Twp, PA 16066", phone: "+1 724-772-8282", website: "https://www.rectenwald.com" },
  { name: "Redhawk Group", type: "GC", address: "950 N 72nd St #100, Seattle, WA 98103", phone: "(206) 282-3000" },
  { name: "Redside Partners LLC", type: "GC", address: "1620 Broadway Ste 201, Seattle, WA 98122", phone: "(206) 210-6249" },
  { name: "Refuge Revival", type: "GC" },
  { name: "Retail Construction Group INC", type: "GC", address: "12514 130th LN NE, Kirkland, WA 98034", phone: "(425) 202-6842" },
  { name: "Retail Contracting Group", type: "GC", address: "3880 Laverne Ave N #215, Lake Elmo, MN 55042", phone: "+1 612-257-7974", website: "https://www.retailcontractinggroup.com/" },
  { name: "Rhino", type: "GC" },
  { name: "RM Built", type: "GC" },
  { name: "Rubicon Construction", type: "GC" },
  { name: "Sawhorse Revolution", type: "GC", website: "https://www.sawhorserevolution.org" },
  { name: "Schuchart", type: "GC" },
  { name: "Seattle Construction Inc", type: "GC", address: "1414 Elliott Ave West, Seattle, WA 98119", phone: "(206) 282-7500", website: "http://www.seattleconstructioninc.com/" },
  { name: "Seattle Mobile Builders LLC", type: "GC", phone: "(503) 351-4774", website: "https://www.seattlemobilebuilders.com" },
  { name: "Shames", type: "GC" },
  { name: "Stout LLC", type: "GC", address: "1113 S 500 W, Bountiful, UT 84010", phone: "(801) 296-2150", website: "https://stoutllc.com/" },
  { name: "Sunset Pacific", type: "GC" },
  { name: "SW Hathaway", type: "GC" },
  { name: "TEEL Construction", type: "GC" },
  { name: "TS Nisbit Construction", type: "GC" },
  { name: "Twin Shores", type: "GC" },
  { name: "Viking Construction", type: "GC" },
  { name: "Walefins Construction", type: "GC", address: "20832 NE 26th Place, Sammamish, WA 98074", phone: "(206) 696-1284" },
  { name: "Wentzel Building", type: "GC" },
  { name: "Wilcox", type: "GC", phone: "(425) 774-4185" },
  { name: "Woodman", type: "GC", address: "10910 117th Pl NE Bldg 6, Kirkland, WA 98033", phone: "(425) 454-3621", website: "https://woodmanconstruction.com/" },

  // ── Subcontractors / Specialty Trades ─────────────────────────────────────
  { name: "A+ Backflow", type: "Sub", phone: "(425) 830-3749" },
  { name: "American Leak Detection", type: "Sub" },
  { name: "American Rooter Sewer and Drain", type: "Sub" },
  { name: "Backflows Northwest", type: "Sub", address: "12819 SE 38th St. #57, Bellevue, WA 98006", phone: "(425) 277-2888" },
  { name: "Batmaster", type: "Sub", phone: "(425) 397-0275" },
  { name: "CFM", type: "Sub" },
  { name: "CMA Restaurant Supply", type: "Sub" },
  { name: "D&G", type: "Sub", phone: "(262) 789-9237", website: "https://dnginsulation.com" },
  { name: "Eco Line", type: "Sub" },
  { name: "Evergreen Concrete Cutting", type: "Sub" },
  { name: "Evergreen Hydronics", type: "Sub", phone: "(206) 423-5156" },
  { name: "Flow Six Inc", type: "Sub", phone: "(206) 551-5242" },
  { name: "Hudson Bay", type: "Sub", phone: "(206) 763-9484", website: "https://hudsonbayins.com" },
  { name: "Junk Removal Inc", type: "Sub" },
  { name: "K. Fox Insulation", type: "Sub", phone: "(360) 474-0304" },
  { name: "Mechanical Resource Services", type: "Sub" },
  { name: "Omni Mechanical", type: "Sub", phone: "(425) 443-2093", website: "https://www.OmniMechUSA.com" },
  { name: "Pacific Rim Inc", type: "Sub" },
  { name: "Pacific Rim Pipe Wrapping", type: "Sub", phone: "(428) 750-3441" },
  { name: "Perkins Excavating", type: "Sub" },
  { name: "Pops Backflow Testing Inc.", type: "Sub", address: "11138 5th Ave S., Seattle, WA 98168", phone: "(206) 551-5174" },
  { name: "Seanet", type: "Sub" },
  { name: "SimplyGBC", type: "Sub" },
  { name: "Stonecraft", type: "Sub" },
  { name: "West Coast Grease Traps", type: "Sub", website: "https://westcoastgreasetraps.com/" },
  { name: "Western Insulation", type: "Sub" },
  { name: "Wolf Skill Construction", type: "Sub" },

  // ── Vendors / Suppliers ───────────────────────────────────────────────────
  { name: "ABC Transmission (Tacoma)", type: "Vendor", address: "5032 S Tacoma Way, Tacoma, WA 98409", phone: "(253) 472-9673", website: "http://www.abctransmission.org/" },
  { name: "Acme & PF Supply", type: "Vendor", address: "4747 1st Ave S, Seattle, WA", phone: "(206) 464-1480", website: "https://www.acmetool.com" },
  { name: "Akopyan & Company", type: "Vendor", address: "315 1st Ave W. #B, Seattle, WA 98119", phone: "(206) 838-3800" },
  { name: "Allumia", type: "Vendor", phone: "(206) 452-7900", website: "https://www.allumia.com/" },
  { name: "Amazon", type: "Vendor" },
  { name: "Atlas Construction", type: "Vendor", address: "4044 22nd Ave W, Seattle, WA 98199", phone: "(206) 283-2000" },
  { name: "Ballard Custom Audio", type: "Vendor", address: "310 NW 40th St, Seattle, WA 98107", phone: "(206) 457-4080" },
  { name: "Ballard Industrial", type: "Vendor", address: "4749 Ballard Ave NW, Seattle, WA 98107", phone: "(206) 783-6626" },
  { name: "CBIC (Ralston & Ralston)", type: "Vendor", address: "PO Box 986, Poulsbo, WA 98370", phone: "(360) 452-8415" },
  { name: "Central Gasses", type: "Vendor", address: "5401 4th Ave S, Seattle, WA 98108", phone: "(206) 766-9353" },
  { name: "Central Welding", type: "Vendor", address: "5401 4th Ave S, Seattle, WA 98108", phone: "(206) 766-9353" },
  { name: "Columbia Hydronics", type: "Vendor" },
  { name: "Consolidated Supply", type: "Vendor", address: "805 NW 42nd St, Seattle, WA 98107", phone: "(206) 784-0047" },
  { name: "DB Accounting", type: "Vendor", address: "14819 SE 82nd Dr, Clackamas, OR 97015", phone: "(503) 342-2015" },
  { name: "Distribution International", type: "Vendor", address: "700 Powell Ave SW, Renton, WA 98057", phone: "(425) 228-4111" },
  { name: "Ed's Transmission", type: "Vendor", address: "1811 Everett Ave, Everett, WA 98201", phone: "(425) 252-2161", website: "https://www.edstransmission.com" },
  { name: "ELS Construction", type: "Vendor", address: "1100 E NASA Pkwy #650, Houston, TX 77058", phone: "(832) 737-6038" },
  { name: "Ferguson Supply", type: "Vendor", address: "1521 1st Ave S Ste 103-105, Seattle, WA 98134", phone: "(206) 505-0980" },
  { name: "Guardian Water & Power", type: "Vendor", address: "3100 #24 Airport Way S, Seattle, WA 98134", phone: "(800) 444-9283" },
  { name: "Heart Saver Institute", type: "Vendor", address: "1 N Village Green #1F, Levittown, NY 11756", phone: "(877) 970-9009" },
  { name: "Ingersoll Rand", type: "Vendor", address: "20121 72nd Ave S, Kent, WA 98032", phone: "(253) 236-9999" },
  { name: "Jay's Garage", type: "Vendor", address: "4601 Shilshole Ave NW, Seattle, WA 98107", phone: "(206) 327-9465" },
  { name: "Just Cars Adv Locksmith", type: "Vendor", phone: "(206) 769-4485" },
  { name: "Keller Supply", type: "Vendor", address: "3209 17th Ave W, Seattle, WA 98119", phone: "(206) 285-3800" },
  { name: "Lang's Towing", type: "Vendor", address: "1528 Northwest Leary Way, Seattle, WA 98107", phone: "(206) 322-3383", website: "https://langtowingseattle.com/" },
  { name: "Nethers Industries", type: "Vendor", address: "1633 Commerce St, Enumclaw, WA 98022", phone: "(800) 997-7940", website: "https://netherind.com/" },
  { name: "Noritz", type: "Vendor" },
  { name: "Pacific Plumbing Supply", type: "Vendor", address: "1417 12th Ave, Seattle, WA 98122", phone: "(206) 322-1717" },
  { name: "PacWest Sales", type: "Vendor", address: "11112 47th Ave W, Mukilteo, WA 98275", phone: "(425) 493-9680" },
  { name: "Paramount Supply", type: "Vendor", address: "10832 E. Marginal Way S, Seattle, WA 98168", phone: "(206) 762-1717", website: "https://www.paramountsupply.com/" },
  { name: "Precision Auto", type: "Vendor", address: "3723 6th Ave, Tacoma, WA 98406", phone: "(253) 759-2044", website: "http://www.preauto.com/" },
  { name: "Salmon Bay Gravel", type: "Vendor", address: "5228 Shilshole Ave NW, Seattle, WA 98107", phone: "(206) 784-1234" },
  { name: "Seattle Land Broker", type: "Vendor", phone: "(206) 973-3022", website: "https://www.SeattleLandBroker.com" },
  { name: "Sip and Ship - Ballard", type: "Vendor", address: "1752 NW Market St, Seattle, WA 98107", phone: "(206) 789-4488" },
  { name: "Stone Drew / Ashe & Jones", type: "Vendor", address: "710 S Lucile St, Seattle, WA 98108", phone: "(206) 763-2850" },
  { name: "Submeter Solutions", type: "Vendor", address: "19115 68th Ave S H108, Kent, WA 98032", phone: "(425) 228-6831" },
  { name: "Sunbelt Rentals", type: "Vendor", address: "17950 Redmond Way, Redmond, WA 98052", phone: "(425) 885-0505" },
  { name: "Superior Auto - Ballard", type: "Vendor", address: "4333 Leary Wy NW, Seattle, WA 98107", phone: "(206) 782-6474" },
  { name: "Taylor Boiler & Equipment Co.", type: "Vendor", address: "9943 NE 6th Drive, Portland, OR 97211", phone: "(503) 285-9800" },
  { name: "VCC USA", type: "Vendor" },
  { name: "Viega", type: "Vendor", address: "585 Interlocken Blvd, Broomfield, CO 80021", phone: "(800) 976-9819" },

  // ── Owners / Customers ────────────────────────────────────────────────────
  { name: "AEG Presents", type: "Owner", website: "https://www.aegpresents.com/" },
  { name: "Big Picture", type: "Owner" },
  { name: "Brass Tacks NW", type: "Owner" },
  { name: "Channel Marker Cider", type: "Owner", address: "5201 15th Ave NW, Seattle, WA 98107", website: "http://www.channelmarkercider.com/" },
  { name: "Communion", type: "Owner" },
  { name: "Darlene Henderson", type: "Owner" },
  { name: "Deru Market", type: "Owner" },
  { name: "Eddie Gulberg", type: "Owner", phone: "(206) 948-7226" },
  { name: "Edouardo Jordan", type: "Owner", phone: "(206) 310-0750" },
  { name: "ESR Hospitality", type: "Owner", address: "2622 NW Market St, Ste A, Seattle, WA 98107" },
  { name: "Ethan Stowell Restaurants", type: "Owner", address: "2622 NW Market St, Ste A, Seattle, WA 98107", phone: "(206) 588-0030", website: "https://ethanstowellrestaurants.com" },
  { name: "Hattie's Hat", type: "Owner" },
  { name: "Joule", type: "Owner" },
  { name: "Juice Box", type: "Owner" },
  { name: "Junebaby", type: "Owner" },
  { name: "Kells Irish Bar", type: "Owner" },
  { name: "Kiddie Academy", type: "Owner" },
  { name: "Le Coin", type: "Owner" },
  { name: "Marination", type: "Owner" },
  { name: "Michou", type: "Owner" },
  { name: "Mighty Kidz", type: "Owner" },
  { name: "Obec Brewery", type: "Owner" },
  { name: "Off Ramp Brewery", type: "Owner" },
  { name: "Old Salt", type: "Owner" },
  { name: "Percy's", type: "Owner" },
  { name: "Pike Brewing Company", type: "Owner", address: "1415 1st Ave, Seattle, WA", phone: "(206) 622-6044" },
  { name: "Plenty of Clouds", type: "Owner" },
  { name: "Puffin Farms", type: "Owner" },
  { name: "Razzi Pizza", type: "Owner" },
  { name: "Rupee", type: "Owner" },
  { name: "Sea Creatures", type: "Owner" },
  { name: "Sea Wolf Bakery", type: "Owner" },
  { name: "Seattle Bouldering Project", type: "Owner" },
  { name: "Sonya's Bar and Grill", type: "Owner" },
  { name: "Stacy and Witbeck", type: "Owner", phone: "(503) 231-6692" },
  { name: "Stoneway Cafe", type: "Owner" },
  { name: "Stumbletown", type: "Owner" },
  { name: "Uneeda Burger", type: "Owner" },
  { name: "Union", type: "Owner" },
  { name: "We Are Unicorns", type: "Owner" },
  { name: "Webb Building LLC", type: "Owner" },

  // ── Other (Engineers, Architects, Utilities, Services) ────────────────────
  { name: "Abossein Engineering", type: "Other" },
  { name: "Apex Imaging Services", type: "Other" },
  { name: "Broderick Architects", type: "Other" },
  { name: "Burman Design", type: "Other" },
  { name: "Chesmore Buck Architecture", type: "Other", address: "27 100th Ave NE #100, Bellevue, WA 98004", phone: "(425) 679-0907", website: "https://www.chesmorebuck.com" },
  { name: "Farwest Advisors llc", type: "Other" },
  { name: "GPS Trackit", type: "Other" },
  { name: "Heliotrope", type: "Other" },
  { name: "HV Engineering", type: "Other" },
  { name: "Mike's Plumbing", type: "Other", phone: "(425) 775-0201" },
  { name: "Plumbing by Mario", type: "Other", phone: "(206) 283-6167" },
  { name: "Premera Health Ins", type: "Other" },
  { name: "Prima Plumbing", type: "Other", phone: "(206) 706-0300" },
  { name: "Puget Sound Energy (PSE)", type: "Other" },
  { name: "Rainbow Consulting", type: "Other" },
  { name: "Robison Engineering Inc", type: "Other" },
  { name: "SDH Architecture INC", type: "Other" },
  { name: "Seattle Public Utilities", type: "Other" },
  { name: "Suyama Peterson Deguchi", type: "Other" },
  { name: "Washington State Department of Enterprise Services", type: "Other" },
  { name: "Waste Management", type: "Other", address: "8101 1st Ave S, Seattle, WA 98108", phone: "(206) 962-7732", website: "https://www.wm.com" },
];

// ---------------------------------------------------------------------------

type StepStatus = "idle" | "running" | "done" | "error";

type ImportLog = {
  message: string;
  type: "info" | "success" | "error" | "warn";
};

export default function ImportPage() {
  const [log, setLog] = useState<ImportLog[]>([]);
  const [status, setStatus] = useState<StepStatus>("idle");

  function addLog(message: string, type: ImportLog["type"] = "info") {
    setLog((prev) => [...prev, { message, type }]);
  }

  async function runImport() {
    setLog([]);
    setStatus("running");

    const auth = (() => {
      try {
        return getFirebaseAuth();
      } catch {
        return null;
      }
    })();

    const userEmail = auth?.currentUser?.email ?? "import@parker";

    try {
      // ── 1. Companies ──────────────────────────────────────────────────────
      addLog("Importing companies…");
      const companyIds: Record<string, string> = {};

      for (const raw of AIRTABLE_COMPANIES) {
        const existing = await getDocs(
          query(collection(db, "companies"), where("name", "==", raw.name))
        );
        if (!existing.empty) {
          const existingDoc = existing.docs[0];
          companyIds[raw.name] = existingDoc.id;
          const data = existingDoc.data();
          const patches: Record<string, unknown> = {};
          if (!data.type) patches.type = raw.type;
          if (!data.phone && raw.phone) patches.phone = raw.phone;
          if (!data.address && raw.address) patches.address = raw.address;
          if (!data.website && raw.website) patches.website = raw.website;
          if (Object.keys(patches).length > 0) {
            await updateDoc(doc(db, "companies", existingDoc.id), patches);
            addLog(`  ↳ ${raw.name} — enriched (${Object.keys(patches).join(", ")})`, "success");
          } else {
            addLog(`  ↳ ${raw.name} already exists — skipped`, "warn");
          }
          continue;
        }
        const companyData: Record<string, unknown> = {
          name: raw.name,
          type: raw.type,
          createdAt: serverTimestamp(),
          createdBy: userEmail,
        };
        if (raw.phone) companyData.phone = raw.phone;
        if (raw.address) companyData.address = raw.address;
        if (raw.website) companyData.website = raw.website;
        const ref = await addDoc(collection(db, "companies"), companyData);
        companyIds[raw.name] = ref.id;
        addLog(`  ↳ Created: ${raw.name} (${raw.type})`, "success");
      }

      // ── 2. Jobs ───────────────────────────────────────────────────────────
      addLog("\nImporting jobs…");

      for (const raw of AIRTABLE_JOBS) {
        const existing = await getDocs(
          query(collection(db, "Jobs"), where("jobName", "==", raw.jobName))
        );
        if (!existing.empty) {
          addLog(`  ↳ ${raw.jobName} already exists — skipped`, "warn");
          continue;
        }

        const gcId = raw.gcName ? (companyIds[raw.gcName] ?? undefined) : undefined;

        const jobData: Record<string, unknown> = {
          jobName: raw.jobName,
          projectPhase: raw.projectPhase,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userEmail,
        };

        if (raw.gcName) jobData.gcName = raw.gcName;
        if (gcId) jobData.gcId = gcId;
        if (raw.siteAddress) jobData.siteAddress = raw.siteAddress;
        if (raw.siteCity) jobData.siteCity = raw.siteCity;
        if (raw.siteState) jobData.siteState = raw.siteState;
        if (raw.siteZip) jobData.siteZip = raw.siteZip;
        if (raw.originalContractValue) {
          jobData.originalContractValue = raw.originalContractValue;
          jobData.currentContractValue = raw.originalContractValue;
        } else {
          jobData.currentContractValue = 0;
        }

        const jobRef = await addDoc(collection(db, "Jobs"), jobData);

        if (raw.notes) {
          await addDoc(collection(db, "Jobs", jobRef.id, "activity"), {
            text: `[Imported from Airtable]\n\n${raw.notes}`,
            tag: "General",
            createdAt: serverTimestamp(),
            createdBy: userEmail,
            createdByName: "Airtable Import",
          });
        }

        addLog(`  ↳ Created: ${raw.jobName} (${raw.projectPhase})`, "success");
      }

      // ── 3. Contacts ───────────────────────────────────────────────────────
      addLog("\nImporting contacts…");

      for (const raw of AIRTABLE_CONTACTS) {
        const companyId = raw.companyName ? (companyIds[raw.companyName] ?? undefined) : undefined;
        const companyName = raw.companyName ?? undefined;

        const existingQuery = companyId
          ? query(
              collection(db, "contacts"),
              where("firstName", "==", raw.firstName),
              where("lastName", "==", raw.lastName),
              where("companyId", "==", companyId)
            )
          : query(
              collection(db, "contacts"),
              where("firstName", "==", raw.firstName),
              where("lastName", "==", raw.lastName)
            );

        const existing = await getDocs(existingQuery);
        const fullName = `${raw.firstName} ${raw.lastName}`;

        if (!existing.empty) {
          addLog(`  ↳ ${fullName} already exists — skipped`, "warn");
          continue;
        }

        const contactData: Record<string, unknown> = {
          firstName: raw.firstName,
          lastName: raw.lastName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userEmail,
        };
        if (companyId) contactData.companyId = companyId;
        if (companyName) contactData.companyName = companyName;
        if (raw.title) contactData.title = raw.title;
        if (raw.email) contactData.email = raw.email;
        if (raw.phone) contactData.phone = raw.phone;

        await addDoc(collection(db, "contacts"), contactData);
        const label = companyName ? `${fullName} (${companyName})` : fullName;
        addLog(`  ↳ Created: ${label}`, "success");
      }

      // ── 4. Jurisdictions ──────────────────────────────────────────────────
      addLog("\nImporting jurisdictions…");

      for (const raw of AIRTABLE_JURISDICTIONS) {
        const existing = await getDocs(
          query(collection(db, "jurisdictions"), where("name", "==", raw.name))
        );
        if (!existing.empty) {
          addLog(`  ↳ ${raw.name} already exists — skipped`, "warn");
          continue;
        }

        const jData: Record<string, unknown> = {
          name: raw.name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userEmail,
        };
        if (raw.state) jData.state = raw.state;
        if (raw.phone) jData.phone = raw.phone;
        if (raw.inspectionPhone) jData.inspectionPhone = raw.inspectionPhone;
        if (raw.address) jData.address = raw.address;
        if (raw.website) jData.website = raw.website;
        if (raw.notes) jData.notes = raw.notes;
        if (raw.contactNames) jData.contactNames = raw.contactNames;

        await addDoc(collection(db, "jurisdictions"), jData);
        addLog(`  ↳ Created: ${raw.name}`, "success");
      }

      // ── 5. Employees ──────────────────────────────────────────────────────
      addLog("\nImporting employees…");

      for (const raw of AIRTABLE_EMPLOYEES) {
        const existing = await getDocs(
          query(collection(db, "employees"), where("email", "==", raw.email))
        );
        if (!existing.empty) {
          addLog(`  ↳ ${raw.firstName} ${raw.lastName} already exists — skipped`, "warn");
          continue;
        }

        const empData: Record<string, unknown> = {
          firstName: raw.firstName,
          lastName: raw.lastName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userEmail,
        };
        const empFields: (keyof RawEmployee)[] = [
          "phone", "email", "emailPersonal", "role", "homeAddress",
          "partnerName", "partnerPhone", "partnerEmail",
          "emergencyContact1", "emergency1Phone",
          "emergencyContact2", "emergency2Phone",
          "status", "birthday", "hireDate",
          "licenseId", "licPlumbing", "expPlumbing",
          "licScissorLift", "expGas", "licGas", "deviceNumber",
        ];
        for (const field of empFields) {
          if (raw[field]) empData[field] = raw[field];
        }

        await addDoc(collection(db, "employees"), empData);
        addLog(`  ↳ Created: ${raw.firstName} ${raw.lastName} (${raw.role ?? "—"})`, "success");
      }

      addLog("\nImport complete!", "success");
      setStatus("done");
    } catch (err) {
      addLog(
        `\nError: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
      setStatus("error");
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Airtable Import</h1>
          <p className="mt-1 text-sm text-gray-600">
            One-time import of {AIRTABLE_JOBS.length} jobs, {AIRTABLE_COMPANIES.length} companies,{" "}
            {AIRTABLE_CONTACTS.length} contacts, {AIRTABLE_JURISDICTIONS.length} jurisdictions,
            and {AIRTABLE_EMPLOYEES.length} employees.
            Safe to run multiple times — existing records are skipped.
          </p>
        </div>

        {/* Preview */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
            What will be imported
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">
                Jobs ({AIRTABLE_JOBS.length})
              </p>
              <ul className="space-y-0.5">
                {AIRTABLE_JOBS.map((j) => (
                  <li key={j.jobName} className="text-xs text-gray-700">
                    {j.jobName}{" "}
                    <span className="text-gray-400">({j.projectPhase})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Companies ({AIRTABLE_COMPANIES.length})
                </p>
                <ul className="space-y-0.5">
                  {(["GC", "Sub", "Vendor", "Owner", "Other"] as const).map((t) => {
                    const count = AIRTABLE_COMPANIES.filter((c) => c.type === t).length;
                    return count > 0 ? (
                      <li key={t} className="text-xs text-gray-700">
                        {count} {t === "GC" ? "General Contractors" : t === "Sub" ? "Subcontractors" : t === "Owner" ? "Owners/Clients" : t === "Vendor" ? "Vendors/Suppliers" : "Other"}
                      </li>
                    ) : null;
                  })}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Contacts ({AIRTABLE_CONTACTS.length})
                </p>
                <ul className="space-y-0.5">
                  <li className="text-xs text-gray-700">
                    {AIRTABLE_CONTACTS.filter((c) => c.companyName).length} linked to a company or jurisdiction
                  </li>
                  <li className="text-xs text-gray-700">
                    {AIRTABLE_CONTACTS.filter((c) => c.email).length} with email
                  </li>
                  <li className="text-xs text-gray-700">
                    {AIRTABLE_CONTACTS.filter((c) => c.phone).length} with phone
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Jurisdictions ({AIRTABLE_JURISDICTIONS.length})
                </p>
                <ul className="space-y-0.5">
                  {AIRTABLE_JURISDICTIONS.map((j) => (
                    <li key={j.name} className="text-xs text-gray-700">{j.name}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">
                  Employees ({AIRTABLE_EMPLOYEES.length})
                </p>
                <ul className="space-y-0.5">
                  {AIRTABLE_EMPLOYEES.map((e) => (
                    <li key={e.email} className="text-xs text-gray-700">
                      {e.firstName} {e.lastName}
                      {e.role && <span className="text-gray-400"> — {e.role}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Run button */}
        <button
          type="button"
          onClick={runImport}
          disabled={status === "running"}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {status === "running" ? "Importing…" : "Run Import"}
        </button>

        {/* Log output */}
        {log.length > 0 && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-900 p-5">
            <pre className="text-xs leading-relaxed">
              {log.map((entry, i) => (
                <div
                  key={i}
                  className={
                    entry.type === "success"
                      ? "text-green-400"
                      : entry.type === "error"
                      ? "text-red-400"
                      : entry.type === "warn"
                      ? "text-yellow-400"
                      : "text-gray-300"
                  }
                >
                  {entry.message}
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>
    </AppShell>
  );
}
