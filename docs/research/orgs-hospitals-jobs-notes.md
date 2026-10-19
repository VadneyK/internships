# Hospitals, Davis and Yolo seasonal jobs, Boys and Girls Clubs and YMCA (checked 2026-10-16)

This is the paper trail for GitHub issues #3 (hospital teen volunteer programs), #4 (City of Davis and Yolo County seasonal youth jobs) and #6 (Boys and Girls Clubs, YMCA branches and Girls State as separate cards).

## How this was checked
- Every card comes from an official page that was read in full on 2026-10-16. Search engines were used only to find official pages. Pages that block plain fetches were read with Firecrawl.
- A second reader re-opened a sample of the official pages and compared them with the cards: the City of Davis Lifeguard and Summer Playgrounds postings, the City of Winters Lifeguard posting, the Summer 2026 Davis RecGuide (aquatics courses), Regional Medical Center San Jose, Sutter Mills-Peninsula, the HEAL page at Highland Hospital, El Camino Health, Camp Mendocino, the YMCA SF Youth Empowerment Fund, Bear Valley YMCA Camp and three California Girls State pages. All matched. Two small fixes came out of that check: the Davis Summer Playgrounds shift starts at 7:30 a.m. and the posting listed a Mar 3, 2026 closing date as well as the Feb 27 final filing date; and the Bear Valley page does not say CITs can take the $550 Zero Week, so that line was dropped.
- 2027 dates are not posted for most programs, so those cards show last year's dates with `last-year-pattern`.

## Counts
- Issue #3: 13 new cards (5 Kaiser medical centers, 4 Sutter sites, the HEAL internship at Highland Hospital, and 3 county hospitals that are sister hospitals of Valley Medical Center). El Camino Health Junior Auxiliary updated (new address, roles, contacts). Not listed: Alta Bates Summit and the Alameda Health System volunteer program (18 and up), Sutter Davis (no student volunteers), and several Kaiser centers that are closed, paused or adults only (details below).
- Issue #4: 6 new cards (Davis lifeguard and swim instructor jobs, Davis summer camp recreation leader jobs, Davis Rec Leader in Training, West Sacramento lifeguard and recreation leader jobs, Winters lifeguard). Davis aquatics classes card updated with 2026 fees and ages. Yolo County still has no high school intern or summer youth job program on its official site.
- Issue #6: 11 new cards (8 YMCA, 3 Boys and Girls Clubs). California Girls State already had its own card; it was re-read and updated (2027 form timing, what delegates do). The Boys State card now points to it. Not listed: Boys and Girls Clubs of Silicon Valley (spam links still injected on bgclub.org), and clubs whose pages give no ages or no way to join (details below).

## Open questions for a maintainer
- The HEAL page (healthpath-ahs.org) only loads over plain http, and the schema needs an https `url`, so the card links to Alameda Health System's own news post about HEAL and names the live page in its notes.
- Sutter Mills-Peninsula states its youth windows (May 1 to 15 and November 1 to 15) as a standing yearly rule with no year printed. The card treats Nov 1 to 15, 2026 as confirmed.
- Kaiser's volunteer portal is kpvolunteer.samaritan.com, which kp.org pages link to. The old volunteer-ncal.kaiserpermanente.org link that many kp.org pages still use is dead.
- The Boys and Girls Clubs of Silicon Valley site (bgclub.org) still shows injected spam links. Someone should tell the club.

## Issue #3: hospitals

All pages below were read with firecrawl on 2026-10-16 unless marked otherwise.

### Kaiser Permanente Northern California

Kaiser runs volunteering through its own portal at `kpvolunteer.samaritan.com/custom/511` (Kaiser Permanente branded, "Copyright Kaiser Foundation Health Plan"). kp.org facility pages link to it (Santa Clara page: "To become a volunteer please visit kpvolunteer.samaritan.com"). Many kp.org pages still link to `volunteer-ncal.kaiserpermanente.org`, which no longer resolves (DNS failure). Each medical center has its own page and sometimes a "High School Programs" listing.

Full list of locations: https://kpvolunteer.samaritan.com/custom/511/org_search

| Medical center | URL | What the page says | Result |
|---|---|---|---|
| Walnut Creek | https://kpvolunteer.samaritan.com/custom/511/affiliation_details/4527002 (also organization_details/622, kp.org dept page) | High school: min age 15, commitment spans whole high school career, one 3 to 4 hour shift a week. Apply button shown; Status line blank. Phone 925-295-5487. | CARD `kaiser-walnut-creek-high-school-volunteer` |
| Santa Clara (Homestead) | https://kpvolunteer.samaritan.com/custom/511/affiliation_details/1157014 (also organization_details/616, kp.org facility page) | 16+, one 4-hour weekday shift (8 am to 6 pm), planned one year. 16 to 17: virtual interview, health screening with immunization records (parent must attend), online trainings, in-person orientation. Apply button shown. Phone 408-851-1717. | CARD `kaiser-santa-clara-high-school-volunteer` |
| San Jose | https://kpvolunteer.samaritan.com/custom/511/organization_details/613 | "OUR HIGH SCHOOL PROGRAM IS FULL AND APPLICATIONS ARE CURRENTLY CLOSED". 16+, one year, 1 or 2 references; minors accepted sporadically. Phone 408-972-7230. | CARD `kaiser-san-jose-high-school-volunteer` (status unconfirmed) |
| Redwood City (and San Mateo offices) | https://kpvolunteer.samaritan.com/custom/511/organization_details/1648 and kp.org dept page | "We are currently not accepting applications. Check back in 2027." HS: 16+, applications open only when shifts are available, one-year commitment. kp.org says students 16 to 17, 4 hours a week, 6 months (conflict noted on card). Phone 650-299-3135. | CARD `kaiser-redwood-city-high-school-volunteer` (closed-expect-reopen) |
| South San Francisco (with Daly City, San Bruno) | https://kpvolunteer.samaritan.com/custom/511/organization_details/619, organization_details/1645 (Daly City), kp.org dept page | HS 16+, accepted sporadically, commitment spans HS career; "currently accepting a very limited number of applications. Adults, 18+, may submit applications". Volunteer phone 650-742-2678. | CARD `kaiser-south-san-francisco-high-school-volunteer` (unconfirmed) |
| Oakland | https://kpvolunteer.samaritan.com/custom/511/organization_details/607, affiliation_details/3689509, kp.org dept page | Has a "High School Programs" listing but it says "Currently not available" and gives no age or rules. kp.org lists a Students phone: 510-752-7373. | REJECT: no age or rules posted, track not available. Tip: call 510-752-7373. |
| Richmond | https://kpvolunteer.samaritan.com/custom/511/organization_details/609 | "Richmond Medical Center Volunteer Program is temporarily closed." No HS listing. | REJECT: program paused, no teen track |
| San Leandro (and Union City) | https://kpvolunteer.samaritan.com/custom/511/organization_details/614 | "WE DO NOT ACCEPT HIGH SCHOOL APPLICATIONS." | REJECT: no teen track |
| Fremont | https://kpvolunteer.samaritan.com/custom/511/organization_details/604 | "WE DO NOT ACCEPT HIGH SCHOOL APPLICATIONS." | REJECT: no teen track |
| San Francisco (Geary) | https://kpvolunteer.samaritan.com/custom/511/organization_details/612 | All programs "over the age of 18". | REJECT: 18+ |
| Pleasanton, San Ramon offices | org_search listing (organization_details/635, 636) | "NOT CURRENTLY ACCEPTING HIGH SCHOOL APPLICATIONS". | REJECT: HS paused (a Carondelet High School page from Nov 2025 said Kaiser wanted HS volunteers here; that is a lead and is now out of date) |
| Sacramento (Morse Ave) | https://kpvolunteer.samaritan.com/custom/511/organization_details/611 | "Our applications are currently closed until further notice." No HS listing. | REJECT: closed, no teen track |
| South Sacramento | https://kpvolunteer.samaritan.com/custom/511/organization_details/618 | No HS listing (Medical Office, Guest, Hospital, Music, Pet, Peer Mentor). | REJECT: no teen track |
| Roseville | org_search listing (organization_details/610) and https://kpvolunteer.samaritan.com/custom/511/organization_details/1621 (Riverside Cirby) | Roseville: "long term volunteer applicants over the age of 18". Cirby/Folsom: "over the age of 18"; applications said closed until September 2026. | REJECT: 18+ |
| Vacaville | https://kpvolunteer.samaritan.com/custom/511/organization_details/620, affiliation_details/1157016, kp.org dept page | Has a "High School Programs" listing with an Apply button, but no age, hours or rules on the page. kp.org: Volunteer Services 707-624-3266, M to F 8 to 5. | NOT CARDED: no age or rules posted; also Vacaville (Solano County) does not fit a region in the schema enum. Tip: call 707-624-3266. |
| Antioch, Manteca, Stockton | org_search listing snippets | 18 and older. | REJECT: 18+ (outside target list anyway) |
| Santa Rosa (and Mercury Way) | org_search listing snippet | "Currently accepting applicants who are 16 years or older in non-clinical roles." | NOT CARDED: North Bay, no region in the schema enum; page not read in full |

Also: Kaiser SYEP High School Internship (community.kp.org) and KP LAUNCH are paid programs; KP LAUNCH already has a card (`kaiser-launch-high-school-program`). Not re-checked here.

### Sutter Health

| Hospital | URL | What the page says | Result |
|---|---|---|---|
| Alta Bates Summit Medical Center | https://www.sutterhealth.org/volunteering/opportunities/volunteer-at-alta-bates-summit-medical-center-1079862874 | "Age range: 18+". General Volunteer Program "is for adults who are 18 years or older". The only other ABSMC listing is Volunteer Doula (adult). No junior, teen or summer track found on sutterhealth.org. | REJECT: 18+ (unchanged from earlier pass) |
| Sutter Davis Hospital | https://www.sutterhealth.org/volunteering/opportunities/volunteer-at-sutter-davis-hospital-1096123222 | "does NOT accept student volunteers (high school, community college, university, or graduate students)". | REJECT: confirmed, no students |
| Eden Medical Center (Castro Valley) | https://www.sutterhealth.org/volunteering/opportunities/volunteer-at-eden-medical-center-1079780181 | "Age range: 16+", actively recruiting; Information Desk, Gift Shop, Family Support. Auxiliary Office 510-727-3080. | CARD `sutter-eden-medical-center-volunteer` |
| Mills-Peninsula (Burlingame, San Mateo) | https://www.sutterhealth.org/volunteering/opportunities/youth-volunteer-at-sutter-mills-peninsula-medical-center-1096205778 | Youth program for HS students 16 and 17. Windows May 1 to 15 and November 1 to 15. Weekly 3 to 4 hours, one-year minimum. Parent and teacher consent forms. | CARD `sutter-mills-peninsula-youth-volunteer` (opens Nov 1, 2026) |
| PAMF Palo Alto Center | https://www.sutterhealth.org/volunteering/opportunities/student-volunteer-at-pamf-palo-alto-center-1096205779 | Student Volunteer, 16+, weekday shifts 8 to 12 or 12 to 4. | CARD `sutter-pamf-palo-alto-student-volunteer` |
| PAMF Mountain View and Sunnyvale | https://www.sutterhealth.org/volunteering/opportunities/student-volunteer-at-pamf-mountain-view-center-1096205788 and .../student-volunteer-at-pamf-sunnyvale-center-1096205777 | Student Volunteer, 16+, six-month commitment, weekday shifts. | CARD `sutter-pamf-mountain-view-sunnyvale-student-volunteer` (one card for both) |
| Sutter Medical Center Sacramento, Sutter Roseville, Sutter Delta, Sutter Tracy | search snippets from sutterhealth.org | "Age range: 18+". | REJECT: 18+ (snippets only, not read in full) |
| Sutter Auburn Faith, Sutter Santa Rosa, Memorial Modesto | search snippets | Student or junior programs exist. | NOT CARDED: outside the target list and not in a schema region; leads for a later pass |

Volunteer search with age filter: https://www.sutterhealth.org/volunteering/results (shows 29 listings at 16+ and 3 at "Teens" across Sutter). CPMC San Francisco has several 16+ listings; one (`cpmc-information-desk-van-ness-volunteer`) is already carded.

### Alameda Health System

| Page | URL | What it says | Result |
|---|---|---|---|
| AHS Volunteers | https://www.alamedahealthsystem.org/ahs-volunteers/ | "individuals who are 18 and older", one 4-hour shift a week for 12 months. | REJECT: 18+ (unchanged) |
| HealthPATH students page | http://healthpath-ahs.org/healthpath-students/ | Lists HEAL (grades 8 to 12, Highland Hospital, Oakland resident or Oakland public school), MIMS, FACES for the Future (11th and 12th graders in Alameda USD at Alameda Hospital, San Leandro USD at San Leandro Hospital). This page is old (2019 flyers). | Used as background only |
| HEAL Program 2026-2027 Internships | http://healthpath-ahs.org/healprogramapply/ | Current: spring 2027 cohorts open Oct 26, 2026, close Nov 17, 2026; summer 2027 opens Jan 5, closes Jan 27, 2027 ($2,000 stipend); fall 2026 cohorts closed ($400 stipend). Eligibility: enrolled in HS and live in Oakland or attend OUSD school/charter. | CARD `alameda-health-system-heal-internship` |
| AHS 2023 press release | https://www.alamedahealthsystem.org/calling-all-oakland-high-schoolers-applications-are-open-for-heal-alameda-health-systems-hands-on-medical-healthpath-internship-program/ | 2023 HEAL dates; links to the HealthPATH apply page. | Used as the card `url` because healthpath-ahs.org does not load over https (connection times out on port 443) and the schema requires https. Please decide whether that is OK. |

FACES for the Future at Alameda and San Leandro hospitals: not carded; official info is only on the old HealthPATH page and facesforthefuture.org was not read. Lead for a later pass.

### Santa Clara Valley Healthcare (county hospitals)

| Hospital | URL | What it says | Result |
|---|---|---|---|
| O'Connor Hospital | https://och.scvh.org/giving-volunteering/volunteer-services/how-become-volunteer and https://och.scvh.org/giving-volunteering/volunteer-services | Students 15+, 6 months or more, no summer-only. Full shot and TB list. | CARD `oconnor-hospital-volunteer` |
| St. Louise Regional Hospital (Gilroy) | https://slrh.scvh.org/giving-volunteering | Students 16+, no summer-only. Phone 408-852-2521. | CARD `st-louise-regional-hospital-volunteer` |
| Regional Medical Center (San Jose) | https://rmc.scvh.org/giving-volunteering/volunteer-services | Junior program 16 to 17, "NOT ACCEPTING APPLICATIONS AT THIS TIME", window January 1 to 7, 2027, 144 hours and 12 months. | CARD `regional-medical-center-san-jose-junior-volunteer` |
| Santa Clara Valley Medical Center | existing card `scvmc-volunteer-services` | Not re-read (verified 2026-10-13). | No change |

### El Camino Health

https://elcaminohealth.org/node/121266 now redirects to https://www.elcaminohealth.org/community/volunteer/auxiliary/applications. Still says check back mid-January 2027 for the next Junior Application Seminar. See `updates-existing.md` for suggested field changes. Also read https://www.elcaminohealth.org/community/volunteer/auxiliary/volunteer-opportunities for junior roles.

### Skipped because a card already exists

- Washington Hospital Fremont: `washington-health-high-school-volunteer`.
- Stanford Health Care: `stanford-health-care-teen-volunteer`. Lucile Packard / Stanford Children's: `stanford-childrens-teen-volunteer`. UCSF BCH Oakland: `ucsf-health-volunteer-bch-oakland`. John Muir Walnut Creek: existing card.

### Tips for teens (with sources)

- Kaiser: kp.org pages still link to volunteer-ncal.kaiserpermanente.org, which is dead. Go to https://kpvolunteer.samaritan.com/custom/511/org_search and pick your medical center. Each center has different rules, and several say high school applications are full or closed and open "sporadically", so check back every few weeks.
- Kaiser does not offer job or clinical shadowing at these centers (Walnut Creek, San Jose, Redwood City, South SF pages).
- Mills-Peninsula takes youth applications only Nov 1 to 15 and May 1 to 15. Get the parent and teacher consent forms signed before the window opens (https://www.sutterhealth.org/volunteering/opportunities/youth-volunteer-at-sutter-mills-peninsula-medical-center-1096205778).
- Regional Medical Center San Jose takes junior applications only Jan 1 to 7, 2027, and needs a reference form (https://rmc.scvh.org/giving-volunteering/volunteer-services).
- HEAL at Highland Hospital: the application has no save button, so write the short answers in a separate document first (http://healthpath-ahs.org/healprogramapply/). Spring 2027 applications open Oct 26, 2026.
- County hospitals (O'Connor, Regional) ask for shot records and a recent TB test; ask your doctor for a copy of your records early (https://och.scvh.org/giving-volunteering/volunteer-services/how-become-volunteer).
- Most hospital programs here say no summer-only volunteering and ask for 6 to 12 months.

### Uncertain items to review

1. `alameda-health-system-heal-internship`: `url` is the 2023 AHS press release because the live HEAL page is http only. Live dates are in `deadline_text` and `notes`.
2. `sutter-mills-peninsula-youth-volunteer`: page states the Nov 1 to 15 window as a yearly rule with no year. I set `deadline_iso` 2026-11-15 and `confirmed-2026-27`; downgrade if you want a year printed on the page.
3. `kaiser-walnut-creek-high-school-volunteer` and `kaiser-santa-clara-high-school-volunteer`: status `rolling` is based on an Apply button being shown; the Walnut Creek Status line is blank.
4. `kaiser-*` cards cite kpvolunteer.samaritan.com (Kaiser's vendor-hosted volunteer portal). kp.org links to it, so I treated it as official.
5. Kaiser Redwood City and South SF: kp.org and the portal disagree on commitment length (6 months or a few months vs one year or whole HS career). Cards use the stricter portal text and say so.

## Issue #4: Davis and Yolo seasonal jobs

GitHub issue #4. Pages were read with curl (NEOGOV job bulletins and class specs, which load without blocking) or with Firecrawl (cityofdavis.org, yolocounty.gov, CalOpps). Search was used only to find official pages.

### Cards written
| File | Why |
|---|---|
| davis-seasonal-lifeguard-swim-instructor.json | Davis Lifeguard (15+) and Swim Instructor (15+, or 14 after Junior Swim Instructor), 2026 postings |
| davis-summer-camp-recreation-leader.json | Davis Summer Playgrounds Recreation Leader (15+) and Outdoor Education Recreation Leader (16+), 2026 postings |
| davis-rec-leader-in-training.json | Davis RLIT (13 to 15) and Outdoor Education Volunteer (14 to 16), fee-based camp volunteer training |
| west-sac-lifeguard-swim-instructor.json | West Sacramento Lifeguard/Swim Instructor (15+), 2026 posting |
| west-sac-recreation-leader.json | West Sacramento Recreation Leader (17+), 2026 postings |
| winters-seasonal-lifeguard.json | Winters Lifeguard (15+), city pays for certification, 2026 posting |

### Pages checked

#### City of Davis
- https://www.cityofdavis.org/city-hall/human-resources/job-opportunities : links to NEOGOV (governmentjobs.com/careers/davis). Says applications are accepted only for posted openings.
- https://www.governmentjobs.com/careers/davis : 9 jobs open on 2026-10-16. No lifeguard, swim or camp job. Teen-relevant open job: Junior Basketball Coach and Official/Score Keeper (Continuous, $17.39, already a card). Pool Maintenance Aide (2026) and Parks Maintenance Aide are open (existing card notes say 21+ and 18+).
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5215786 : Lifeguard (2026). $17.83 to $18.27 hourly. Opened 01/28/2026, closed 4/12/2026. "Applicants must be 15 years of age or older." Red Cross Lifeguard Training/First Aid/CPR/AED and First Aid for Public Safety Personnel (Title 22) at time of employment. Pool schedule May 18 to Sep 7, 2026.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5215801 : Swim Instructor (2026). $16.97 to $17.39 hourly. Opened 01/28/2026, closed 4/21/2026. 15+, or 14 after Jr. Swim Instructor Program.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/4749014 : Off-Season Lifeguard (2024). $16.97 to $17.83. Opened 12/03/2024, closed 1/31/2025. 15+. Weekday mornings and noon.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5238545 : Summer Playgrounds Recreation Leader (2026). $16.97. Opened 02/16/2026, closing 3/3/2026, final filing date Feb 27. "Must be 15 years or older prior to the start of the summer programs." CPR and Standard First Aid before camp.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/4819973 : Summer Playgrounds Recreation Leader (2025). $16.55. Opened 02/04/2025, closed 3/1/2025. Same 15+ rule.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5243401 : Recreation Leader, Outdoor Education (2026). $16.97. Opened 02/19/2026, deadline Mar 16, closing 3/30/2026. 16+. Must own a bike.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/4802295 : Recreation Leader, Outdoor Education (2025). $16.55. Opened 01/22/2025, closed 3/19/2025. 16+.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/4802116 : Inclusion Recreation Leader I/II (2025). $16.55. Opened 01/22/2025, closed 4/1/2025. 15 (CSS I) or 16 (CSS II). A 2026 version was not found.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5466779 : Recreation Leader, Nutcracker 2026. $16.97. Opened 08/31/2026, closed 9/28/2026. "Must be at least 15 years or older, with a current work permit." Work Nov 9 to Dec 13, 2026. Folded into the recreation leader card notes.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5047201 : Recreation Leader, Nutcracker 2025. $16.55. Opened 08/18/2025, closed 10/13/2025. 15+.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5197822 : Camp Putah Recreation Leader (2026). $17.39. "at least 18 years of age or high school graduate." Rejected for the card: 18 or graduate.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5197860 : Senior Recreation Leader, Summer Sampler and Backyard Adventures (2026). $17.83. 18 or high school equivalent plus a California driver's license. Rejected: 18 or graduate.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5238550 : Camp Putah Senior Recreation Leader (2026). $18.27. 18 or high school equivalent. Rejected.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5215693 : Outdoor Camping Guide, Trekkers (2026). 19 by June 1, 2026. Rejected: 18+ only.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5241157 : Adaptive Recreation Leader I, II, III (2026). "Must be 21 years or older." Rejected.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/5371766 : Facility/Special Events Attendant (2026). "Be at least 18 years of age." Rejected.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/1281106 : Teen Activity Specialist (2016). 18+ and twelfth grade. Old posting, rejected.
- https://www.governmentjobs.com/careers/davis/jobs/newprint/4791215 : Recreation Program Assistant (2025). No teen age stated; not used.
- https://www.governmentjobs.com/careers/davis/classspecs/newprint/1169998 : CSS I class spec, $16.56 to $18.73. Lists the entry jobs (aquatics instructors, cashiers, Recreation Leader I for playgrounds, camps, teen services, scorekeepers). No minimum age in the spec, so ages come from each posting.
- https://www.governmentjobs.com/careers/davis/classspecs/newprint/1170000 and /1170002 : CSS II and CSS III class specs. No minimum age stated.
- https://www.governmentjobs.com/careers/davis/classspecs/newprint/1305032 : Intern (General). Office work; no age stated. Not used.
- https://www.cityofdavis.org/city-hall/parks-and-community-services/camps : handbook link and ePACT info. No volunteer or job details.
- https://www.cityofdavis.org/home/showpublisheddocument/21762/639156481228830000 : Summer Camp 2026 Handbook (PDF). "Volunteer Camps" section: Outdoor Education Volunteers 13 to 16, Rec Leader in Training 13 to 15, Playgrounds Returning Volunteers.
- https://www.cityofdavis.org/city-hall/parks-and-community-services/forms-and-publications/recreation-schedules : Rec Guides page. Summer 2026 registration: Feb 25 (Camp Putah, Trekkers, Horse Camps) and Mar 11, 2026 (all other camps and programs), 7 a.m., Davis residents first.
- https://www.cityofdavis.org/home/showpublisheddocument/21309/639229208666270000 : Summer 2026 RecGuide (PDF). RLIT 13 to 15, $247 or $264; Returning RLIT 13 to 16, $66; Outdoor Education Volunteer 14 to 16, $122, applications due Mar 27 by 4 PM; Lifeguard Training 15 by last day, $275; Junior Lifeguard 11 to 15, $185; Junior Swim Instructor 11 to 15, $100.
- https://www.cityofdavis.org/residents/volunteer-opportunities (redirects to /city-hall/parks-and-community-services/volunteer-opportunities) : fall 2026 one-time volunteer shifts. No camp volunteer listing right now.
- https://www.cityofdavis.org/city-hall/parks-and-community-services/teens : TLC (existing card). Nothing new on jobs.
- https://webtrac.cityofdavis.org/webtrac/web/search.html?module=AR&keyword=volunteer : no results today.

#### Yolo County
- https://www.yolocounty.gov/government/general-government-departments/human-resources/college-intern-program : still college only ("priority given to college students that are earning their first undergraduate degree"). Rejected: college only.
- https://www.yolocounty.gov/i-want-to/find/job-with-yolo-county : links to NEOGOV (governmentjobs.com/careers/yolococa). No youth program listed.
- https://www.governmentjobs.com/careers/yolococa (job list) : 10 regular openings plus "2026 Extra Help Applications". No high school or summer youth job.
- https://www.governmentjobs.com/careers/yolococa/jobs/newprint/5191244 : 2026 Extra Help Applications. Lists a "Job Intern/Trainee" interest choice but no youth program, age or pay for teens. Not used.
- https://www.governmentjobs.com/careers/yolococa/jobs/newprint/845178-0 : County of Yolo Volunteer posting, opened 03/27/2014, Continuous. Youth Volunteer category, "minimum of age 15", for high school service hours. Unpaid. Not carded: posting is 12 years old, no description of youth duties, and the Intern/Volunteer/Transfer list could not be loaded to confirm it is still listed. Lead only.
- https://www.yolocounty.gov/business/workforce-innovation-board : WIB oversees One-Stop Career Centers; points to yoloworks.org. No youth program details on the county page. The WIOA youth program in Yolo is run by Yolo County Children's Alliance (existing card yolo-children-alliance-youth-employment).
- Answer to the issue: no current Yolo County high school internship or summer youth employment program was found on yolocounty.gov. The old High School Summer Intern Program is not on the current site.

#### Yolo County Office of Education
- https://www.ycoe.org/youthjobfair/ : could not load (curl returned a tiny page, Firecrawl failed). Search snippet shows a youth and young adult job fair for ages 16 to 24 on "Friday, March 29th" at the Woodland Community and Senior Center, year not shown. Lead only.
- Existing card ycoe-work-based-learning-b-unbound already covers YCOE work-based learning.

#### City of West Sacramento
- https://www.governmentjobs.com/careers/westsacramento (job list) : 9 jobs on 2026-10-16. Teen-age jobs not open. Lead Recreation Leader (Black Box Theater) and Senior Recreation Leader (Adaptive) need a high school diploma and experience; Program Leader KidZone (5383056, $19.00 to $21.50) needs age 18 or a diploma. Rejected.
- https://www.governmentjobs.com/careers/westsacramento/jobs/newprint/5226405 : Lifeguard/Swim Instructor 2026. $17.25 to $18.75. Opened 02/05/2026, closed 5/3/2026. 15+.
- https://www.governmentjobs.com/careers/westsacramento/classspecs/newprint/1281841 : Lifeguard/Swim Instructor class spec (revised April 1, 2019). 15+.
- https://www.governmentjobs.com/careers/westsacramento/jobs/newprint/3942312 : Lifeguard/Swim Instructor 2023. Mar 2 to May 31, 2023.
- https://www.governmentjobs.com/careers/westsacramento/jobs/newprint/5256148 : Recreation Leader, Sports Camp Instructor. $17.00 to $18.50. Mar 3 to Jun 23, 2026. 17+.
- https://www.governmentjobs.com/careers/westsacramento/jobs/newprint/5226361 : Recreation Leader, Customer Service. Feb 5 to Feb 26, 2026. 17+.
- https://www.governmentjobs.com/careers/westsacramento/jobs/newprint/5319842 : Recreation Leader, Customer Service. Apr 23 to May 22, 2026. 17+.
- https://www.governmentjobs.com/careers/westsacramento/classspecs/newprint/1245926 : Recreation Leader class spec. 17+.
- https://www.governmentjobs.com/careers/westsacramento/classspecs/newprint/1440955 : Recreation Aide class spec (revised Jan 10, 2022). 15+, $17.00. No current posting found.
- https://www.governmentjobs.com/careers/westsacramento/jobs/newprint/2194992 : Recreation Aide/Leader (2018). Aug 29 to Sep 19, 2018. Last Rec Aide posting found.
- https://www.governmentjobs.com/careers/westsacramento/jobs/newprint/5252848 : Assistant Pool Manager (2026). Needs 3 years lifeguard experience and a driver's license. Rejected.
- https://www.governmentjobs.com/careers/westsacramento/classspecs/newprint/1285225 : Youth Police Cadet (volunteer, revised April 24, 2019). Grades 9 to 12 or incoming freshman or graduating senior. No current posting or dates found. Lead only; not a seasonal job.

#### City of Woodland
- https://www.cityofwoodland.gov/187/How-to-Apply : Woodland posts jobs on CalOpps (calopps.org/city-of-woodland).
- https://www.cityofwoodland.gov/QuickLinks.aspx?CID=190 : "CSD - Now Hiring" links: Activity Leader I/II, Activity Leader I/II Adult Sports, Lifeguard/Instructor, Lifeguard/Instructor's Aide, Swim Instructor's Aide, Special Program Coordinator.
- https://www.calopps.org/woodland/job-20203601 (Lifeguard/Instructor) and https://www.calopps.org/woodland/job-20203055 (Activity Leader I/II) : "Recruitment closed." No age or pay shown.
- https://www.cityofwoodland.gov/CivicAlerts.aspx?AID=1009 : "Community Services hiring for the summer," posted March 6, 2026, aquatics and summer camps. No ages.
- https://www.cityofwoodland.gov/188/Job-Descriptions : no Lifeguard, Activity Leader or aide job descriptions (only coordinator, supervisor and technician levels).
- https://www.cityofwoodland.gov/160/Aquatics : no job ages.
- Rejected: no official page with a minimum age. Leads only: a Woodland Rec Facebook comment says the swim aide job takes 14-year-olds and lifeguards must be 15; a 2024 Facebook post said some summer staff must be 18 and a year out of high school. A 2017 Activity Leader PDF on CalOpps exists but is too old to use. Next step: read the CalOpps postings when they reopen (likely February to March 2027, since the 2026 hiring news went up March 6).
- Velocity Island Park (private, Woodland) lifeguard page seen in search; private employer, not checked. Lead only.

#### City of Winters
- https://www.cityofwinters.org/Jobs.aspx : points to governmentjobs.com/careers/CITYOFWINTERS.
- https://www.governmentjobs.com/careers/cityofwinters (job list) : 3 police jobs open. No pool job now.
- https://www.governmentjobs.com/careers/cityofwinters/jobs/newprint/5215040 : Lifeguard. $18.00 to $20.00. Opened 01/28/2026, closed 3/1/2026. 15+. City pays for certification. Fingerprint and TB test.
- A Facebook post (lead) mentions supervising guard and pool manager jobs too; those were not found on NEOGOV.

### Rejections summary
- Davis Camp Putah Recreation Leader, Senior Recreation Leaders, Facility/Special Events Attendant, Adaptive Recreation Leader, Trekkers guide, Pool and Parks Maintenance Aides: 18+ (or 18 or high school graduate, 19+, 21+).
- Yolo County College Intern Program: college only.
- Yolo County High School Summer Intern Program: no current official page (only 2009 to 2013 documents).
- Yolo County Youth Volunteer: lead only (2014 posting, could not confirm it is still listed).
- YCOE Youth Job Fair: could not load.
- West Sacramento Program Leader, Lead and Senior Recreation Leader, Assistant Pool Manager: 18+ or diploma and experience.
- West Sacramento Recreation Aide: job class is 15+, but no posting since 2018.
- West Sacramento Youth Police Cadet: no current posting or dates.
- Woodland lifeguard and activity leader: postings closed, no official page with a minimum age.

### Tips for teens (each with a source)
1. Davis posts its summer pool jobs in late January. In 2026 the Lifeguard and Swim Instructor jobs both opened Jan 28. https://www.governmentjobs.com/careers/davis/jobs/newprint/5215786
2. Davis summer camp Recreation Leader jobs opened Feb 16, 2026 and the final filing date was Feb 27, so apply in February. https://www.governmentjobs.com/careers/davis/jobs/newprint/5238545
3. If you are 14 and finished Davis's Junior Swim Instructor class, you can apply to be a paid Swim Instructor a year early. https://www.governmentjobs.com/careers/davis/jobs/newprint/5215801
4. You must already hold Red Cross lifeguard and Title 22 first aid certificates to be a Davis lifeguard, so take the city's Lifeguard Training course (15 by the last day) before you apply. https://www.cityofdavis.org/home/showpublisheddocument/21309/639229208666270000
5. Davis mandatory trainings are not optional. In 2026 lifeguards had to be free May 16 and 17 and June 15 to 18. Check the training dates before you apply. https://www.governmentjobs.com/careers/davis/jobs/newprint/5215786
6. Too young for a Davis camp job? Rec Leader in Training (13 to 15) teaches camp skills and first aid and ends with a practice interview and a week of volunteering. https://www.cityofdavis.org/home/showpublisheddocument/21762/639156481228830000
7. Davis Outdoor Education Volunteer applications were due March 27, 2026, and you need your own bike. https://www.cityofdavis.org/home/showpublisheddocument/21309/639229208666270000
8. The Davis Nutcracker Recreation Leader job (15+) is a fall job posted in late August. In 2026 it closed Sep 28, and you need a current work permit to apply. https://www.governmentjobs.com/careers/davis/jobs/newprint/5466779
9. Winters pays for your lifeguard certification class and starts lifeguards at $18 an hour, but the 2026 posting was open only Jan 28 to Mar 1. https://www.governmentjobs.com/careers/cityofwinters/jobs/newprint/5215040
10. West Sacramento lifeguards can start at 15, but recreation leaders must be 17. https://www.governmentjobs.com/careers/westsacramento/jobs/newprint/5226405 and https://www.governmentjobs.com/careers/westsacramento/classspecs/newprint/1245926
11. Most city jobs here ask for CPR and First Aid before your first day. Davis camp jobs need it before camp starts. https://www.governmentjobs.com/careers/davis/jobs/newprint/5238545
12. You can sign up for job alerts on each city's NEOGOV page so you hear when seasonal jobs open. Davis: https://www.governmentjobs.com/careers/davis ; Winters: https://www.cityofwinters.org/Jobs.aspx

### Uncertainties
- Davis Outdoor Education Volunteer age: the Summer 2026 RecGuide says 14 to 16, but the Summer Camp 2026 Handbook says 13 to 16. The card uses 14 to 16 and notes both.
- No 2027 dates are posted for any of these jobs. All cards use last-year-pattern.
- West Sacramento lifeguard posting gives no hours or season dates.
- The Davis lifeguard card sets min_age 14 because Swim Instructor takes 14-year-olds who finished Junior Swim Instructor; Lifeguard itself is 15.

## Issue #6: Boys and Girls Clubs, YMCA and Girls State

Scope: BGC and YMCA teen jobs, junior staff, CIT/LIT, Leaders Club, Keystone, teen volunteer and workforce programs near the Bay Area and Sacramento/Davis hubs. Rule used: no official page, no card. Pages were read with direct HTTP fetches (most sites did not block them) and Firecrawl for JavaScript-built pages (Alameda BGC, cagirlsstate.org). Search results were used only to find official pages.

### Cards written (11)

| id | why |
|---|---|
| ymca-east-bay-camp-loma-mar-leaders-in-training | 2027 LIT, rising 10th to 11th grade, app opens Jan 1, 2027, session July 11 to 23, 2027 |
| ymca-east-bay-camp-loma-mar-camp-assistant | 2027 CA, rising 12th grade, app opens Jan 1, 2027, session June 20 to July 2, 2027 |
| ymca-sf-camp-jones-gulch-lit-cit | LIT ages 14 to 15, CIT age 16, fee-based overnight camp, 2026 dates only |
| ymca-sf-teen-volunteer | YMCA SF volunteers from age 15, rolling, email application |
| ymca-sf-youth-empowerment-fund | Ages 13 to 24, youth-led grants up to $10,000; Spring 2027 round due Jan 4, 2027 |
| ymca-superior-california-bear-valley-cit | CIT ages 14 to 16, $700 a week (2026), interview |
| ymca-silicon-valley-mt-madonna-high-school-volunteer | Morgan Hill high school volunteers and teen center tutors, open postings through 2027 |
| ymca-silicon-valley-teen-youth-councils | YTI Youth Council (grades 8 to 12, Mountain View) and FNL Council (grades 6 to 12, Morgan Hill); 2025-26 schedule only |
| bgc-peninsula-teen-volunteer-summer-internship | Ages 14+, school-year homework help volunteer and Summer Teen Internship (opens March 2027); SSN and background check required |
| bgc-san-francisco-leaders-in-training | Grades 9 to 12, 70 hours over 10 weeks, $800 gift card, $20 membership |
| bgc-san-francisco-camp-mendocino-lit-cit | LIT ages 15 to 17, CIT 16 to 17, camp fee waived, 2026 deadlines Feb 16 to May 4 |

### Every club, branch and page checked

#### YMCA of the East Bay (ymcaeastbay.org)
- https://www.ymcaeastbay.org/youth-development : lists only Camp Loma Mar (2nd to 12th grade), After School Programs (TK to 8th) and Youth & Government (6th to 12th). No teen center, Leaders Club, teen jobs or "Youth Institute" pages exist in the site menu. **Youth Institute: not found** (that name belongs to a different YMCA).
- https://www.ymcaeastbay.org/youth-development/camp-loma-mar/summer-camp : LIT (entering grades 10 to 11) and CA (entering grade 12), application and interview required. Used.
- https://www.ymcaeastbay.org/youth-development/camp-loma-mar : Fall 2026 events; a "Future Camp Leaders Weekend" for teens is planned for winter or spring, "Dates and details are still in the works". **Rejected for now: no dates, ages or sign-up.** Recheck in early 2027.
- https://www.ymcaeastbay.org/youth-development/camp-loma-mar/get-involved : camp volunteering (trail work, painting) with no age rule, and a summer staff job board link. No teen ages stated. Not used.
- https://www.ymcaeastbay.org/careers : links to an UltiPro job board that needs JavaScript; no teen ages on the careers page. **Rejected: no minimum age stated.**
- https://www.ultracamp.com/info/upcomingSessions.aspx?idCamp=1481&campCode=M8R (the camp's own registration site, linked from ymcaeastbay.org): 2027 sessions, LIT and CA applications with $25 refundable deposits, "Registration will begin on 1/1/2027". Session detail pages idSession=592753 (LIT) and 592745 (CA) read. Used.
- Youth & Government is already covered by `ymca-youth-and-government-ca`.
- Note: Camp Loma Mar belongs to YMCA of the East Bay, not YMCA of San Francisco as the task list guessed.

#### YMCA of Silicon Valley (ymcasv.org)
- https://www.ymcasv.org/education-enrichment/leadership-development : Youth and Government (already carded), Friday Night Live and YTI Leadership Council (used), Model UN (middle school), College Tours (sophomores to seniors, fee trip, no dates), Leaders in Training (no age, see below), Camp Campbell cabin leaders (already carded), Summer Jobs (no ages).
- **Leaders in Training: rejected.** The page says LITs train with 4 to 11 year olds and get CPR and First Aid certified, but gives no age or grade. The linked registration search (https://ymap.ymcasv.org/PersonifyEbusiness/Program-Search/CAT/WEB_EDUCATION_CHILDCARE/SCAT/LEADERSHIP/WL/Y/AUTO/Y/BR/PA/KW/Leaders) returned "0 Results found" on 2026-10-16. Same finding as the earlier pass.
- **College Tours for Teens: rejected** (a paid trip, not a role; no dates or price on the page).
- https://www.ymcasv.org/jobs : general careers text, no teen ages. **Rejected.**
- https://www.ymcasv.org/child-care-camps/summer-day-camps : no CIT or teen counselor info. **Rejected.**
- https://www.ymcasv.org/lifeguard-and-safety-training : Red Cross Lifeguarding course, "Be at least 15 years old on or before the final scheduled session of the course", plus a swim test. Not carded separately because `red-cross-lifeguard-wsi` already covers the course; no YMCA SV lifeguard job age is posted. Used as a tip below.
- https://www.ymcasv.org/ymca-camp-campbell/camps/overnight-camps : no teen leadership info in the fetched text.
- https://www.ymcasv.org/volunteering and https://ymcasv.volunteermatters.org/project-catalog plus project pages 250, 251, 261, 262, 272, 284, 301, 302, 304, 317, 318, 319, 320: Mt. Madonna YMCA "High School Hours Volunteer" (262) and "Volunteer Tutoring" (261) used. Other postings are adult advisory boards, senior meal service, front desk translation, an Oct 16 event, and coaching roles with no age rule.
- Google Forms for the councils (read for dates and grades): https://docs.google.com/forms/d/e/1FAIpQLSfBISSCjmCWDSoH__fb32gA17RAmByrDJP_63XPz89UdMCz4Q/viewform (YTI) and https://docs.google.com/forms/d/e/1FAIpQLSd9empDYwh6AAoie2KbD5fUmD97S69tQpaY3IRcAldwZvWS2g/viewform (FNL). Both still accept answers but describe 2025-26.

#### YMCA of Greater San Francisco (ymcasf.org), including Peninsula Family YMCA
- https://www.ymcasf.org/teens/ : teens ages 13 to 18; links to MYEEP (already `sf-myeep`), youth sports, swim lessons.
- https://www.ymcasf.org/programs/?filters=teens : the teen-tagged programs are mostly fitness, aquatics, after-school care, Workforce Development (already carded), SEGP and YEF.
- https://www.ymcasf.org/program/overnight-summer-camps/ : Camp Jones Gulch LIT (14 to 15) and CIT (16). Used.
- https://www.ymcasf.org/program/summer-camp-outdoor-programs/ : branch day camps for ages about 4 to 13; "Counselor In Training" there points to Camp Jones Gulch. No separate day camp CIT with ages. Used only as a source.
- https://www.ymcasf.org/program/camps/ and https://www.ymcasf.org/location/ymca-camp-jones-gulch/ : no extra teen details.
- https://www.ymcasf.org/get-involved/volunteer/ : minimum volunteer age 15. Used.
- https://www.ymcasf.org/program/youth-empowerment-fund/ : YEF grants, ages 13 to 24. Used.
- https://www.ymcasf.org/program/social-entrepreneurship-guidance-program/ : "TAY Transitional Age Youth 18-24". **Rejected: 18 and older.**
- https://www.ymcasf.org/about/careers/ : no teen jobs or ages. **Rejected.**
- https://www.ymcasf.org/location/peninsula-family-ymca/ : schedules and fitness programs only; no teen leadership, CIT or teen job program. **Rejected.**
- Camp Loma Mar is not a YMCA SF camp (see East Bay).

#### YMCA of Superior California (ymcasuperiorcal.org)
- https://www.ymcasuperiorcal.org/ , /youth-families , /aquatics , /sportscamps , /volunteer-opportunities , /health , /bearvalley
- Bear Valley CIT ages 14 to 16 and Volunteer Junior Counselor at 17. Used.
- Volunteer page: youth sports coach, boards, special events, Y&G advisor, with no ages or teen roles. **Rejected for a separate card.**
- Summer Sports Camps (Yolo County YMCA, Woodland): camper programs for ages 4 to 11 only; no teen roles. **Rejected.**
- "Safe & Fit for Teens" is a fitness offering, not a role. **Rejected.**
- Aquatics: lifeguard training is mentioned, with no age or dates on the page. **Rejected.**
- Careers link goes to an iCIMS job board (https://careers-superior-ymca.icims.com/jobs/search?hashed=-625888824). Not read (JavaScript board); no teen ages on the official pages.

#### Boys & Girls Clubs of the Peninsula (bgcp.org)
- https://www.bgcp.org/ , /programs , /careers , /volunteer , /cpp , /futuregrads , /news
- **Re-check result: teen details are now on the Volunteer page.** Program Support (age 14+, rolling, school year) and Summer Teen Internship (rising 9th to 12th, 14+, opens March 2027). Used.
- Career Pathways (/cpp): mentions summer apprenticeships and internships for members in high school, but gives no ages, dates or how a teen applies (the form is for partners and volunteers). **Rejected.** Contact listed: Cynthia Duran, cduran@bgcp.org.
- Future Grads (/futuregrads): college access program at partner high schools starting the summer before 10th grade. It is college advising, not a job or role, so not carded here; it could fit a college-access list later.
- Careers: Youth Program Leaders, $22 to $25 an hour, no age stated. **Rejected: minimum age not stated.**
- Lead only (not used): job-board postings for "Teen Staff" at BGCP (app.trinethire.com, found in search). The official careers page does not list them. If BGCP posts Teen Staff on bgcp.org, it would be a strong paid card.
- Mid-Peninsula Boys & Girls Club (mpbgc.org did not load) has joined BGCP, per https://www.bgcp.org/news. No separate card.

#### Boys & Girls Clubs of San Francisco (kidsclub.org) and Camp Mendocino
- https://www.kidsclub.org/join-a-club/teens , /programs/job-readiness , /programs/character-leadership-development , /get-involved/volunteer
- LIT flyers (official PDFs on the club's site): https://cdn.prod.website-files.com/5b5e1754c3f7cb50734892a4/68b0a611498e5ccc7ef94726_LIT%20flyer%202025-26.pdf and https://cdn.prod.website-files.com/5b5e1754c3f7cb50734892a4/677d92220020ef84a39fbd92_BGCSF_LIT_Flyer_FINAL_Jan8_2025.pdf
- https://www.campmendocino.org/ , /teen-leadership , /register-for-camp , /faqs
- Club LIT and Camp Mendocino LIT/CIT used.
- Keystone Club: high school, members raise at least $3,000 to attend the National Keystone Conference. **Not a separate card** (no ages beyond "high school", no joining steps beyond membership); mentioned in the LIT card notes.
- "Part-Time Jobs & Internships" on the teens page: its text is a copy of the Money Matters paragraph (a site error), and the job readiness page only says the club connects members to entry-level jobs. **Rejected: no concrete role, ages or steps.**
- Youth of the Year: recognition program, not a role. **Rejected.**
- Note: the teens page says Camp LIT sessions "are ten days long", but the 2026 camp schedule shows 5 to 7 day sessions. The card uses the camp site's dates.

#### Boys & Girls Club(s) of Greater Sacramento (bgcsac.org)
- https://bgcsac.org/ , /what-we-do/programs/ , /what-we-do/programs/academiccareersuccess.html , /what-we-do/programs/character-leadership.html , /how-to-help/careers.html , /how-to-help/volunteering.html
- Keystone Club, ages 14 to 18. **Rejected: no joining steps** (implied membership only), same as the Oakland card's treatment.
- Money Matters (ages 13 to 18): a class, not a role. **Rejected.**
- Volunteer interest form has a "High school community service" option, but no ages, roles or dates. **Rejected.**
- Careers: part-time Program Assistant, Monday to Friday 1:30 to 6:30 PM, no age or pay stated. **Rejected.**
- Lead: the club hosts 5 Bank of America Student Leaders each summer (high school juniors and seniors). That program is run by Bank of America, so it needs its own official page check before any card: https://about.bankofamerica.com/en-us/what-guides-us/student-leaders.html

#### Woodland, Davis, Yolo County
- No Boys & Girls Club found in Woodland, Davis or West Sacramento. Teen programs found there are city or library programs, which belong to the city worker or already have cards (for example `woodland-teens-helping-seniors`). YMCA of Superior California runs the Yolo County YMCA in Woodland (sports camps only).

#### Boys & Girls Clubs of Silicon Valley (bgclub.org)
- Fetched https://bgclub.org/ , https://bgclub.org/careers/ , https://bgclub.org/volunteer/individual-volunteers/ , and https://bgclub.org/teen-programming/ (404).
- **Spam is still there. Not used.** Every page fetched has an injected hidden link with the anchor text "slot gacor" pointing to a gambling page on an unrelated .ac.id site, right before a script tag. This matches the earlier pass. No card was written and no information from bgclub.org was used. Someone should tell the club their WordPress site appears compromised.

#### Boys & Girls Clubs of Contra Costa (bgccontracosta.org)
- https://www.bgccontracosta.org/get-involved : general volunteer and corporate pages; no teen roles or ages. **Rejected.** Note: its job "APPLY" button goes to a Paylocity board titled "Boys-and-Girls-Clubs-of-Silicon-Valley", so the two may now be one organization. Because of the bgclub.org spam, treat that link with care.

#### Alameda Boys & Girls Club (alamedabgc.org)
- https://www.alamedabgc.org/teen-center : Teen Center, Diplomas to Degrees (ages 13+, college and career readiness), Keystone Club (grades 9 to 12), Youth of the Year. No job, volunteer or junior staff role and no joining steps beyond membership. **Rejected.**
- https://www.alamedabgc.org/volunteer : "All volunteers must be over the age of 18 and out of high school." **Rejected: adults only.**
- Note: this is the Alameda city BGC; the city worker covers City of Alameda programs, and there is no overlap.

#### Fremont
- No Fremont Boys & Girls Club or Fremont YMCA teen program page was found. Not pursued further.

#### California Girls State (cagirlsstate.org)
- Re-read home, FAQ, delegates-alternates and About pages. 2027 dates and location are **not** posted; application timing for 2027 is posted (February and April 2027). Details in updates-existing.md.

### Uncertainties to flag
- Camp Loma Mar LIT and CA: the full program fee is not posted (only a $25 refundable deposit). `paid_type` is `not-stated`. If the camp confirms a fee, change to `fee-based`.
- Camp Loma Mar cards use `deadline_confidence` `confirmed-2026-27` with no `deadline_iso`, because the 2027 opening date and session dates are confirmed but no closing date is posted (same approach as the existing Camp Campbell card).
- BGCSF Club LIT: the $800 gift card is a completion reward. The flyers do not say whether a work permit is needed, so `needs_work_permit` is null.
- BGCP Summer Teen Internship: pay is not stated, so `paid_type` is `not-stated` and `needs_work_permit` is null.
- YMCA SV teen councils: the forms still accept answers, but they describe 2025-26, so the card is `unconfirmed`.
- YEF: `status` is `closed-expect-reopen` with `deadline_iso` 2027-01-04, because the Spring 2027 form opens in November 2026 with no exact day, so `opens-soon` (which needs `opens_iso`) could not be used. Consider flipping to `open-now` when the form is posted.
- Jones Gulch: summer 2027 dates and full prices are not posted. The price sits only in the registration system.

### Sourced tips for teens
1. Under 18 at a Boys & Girls Club? Join the Club as a member. BGCSF's adult volunteer program is for people 18 and older and not in high school, and it tells younger teens to join a Clubhouse, where youth volunteer roles exist (https://www.kidsclub.org/get-involved/volunteer). Alameda BGC volunteers must be over 18 and out of high school (https://www.alamedabgc.org/volunteer).
2. YMCA of Greater San Francisco takes volunteers from age 15 and helps with school service hours (https://www.ymcasf.org/get-involved/volunteer/).
3. Camp leadership programs fill early. Camp Mendocino's FAQ says LIT/CIT applications "typically are closed by early April" (https://www.campmendocino.org/faqs). Camp Loma Mar's 2027 LIT and CA applications open January 1, 2027 (https://www.ultracamp.com/info/upcomingSessions.aspx?idCamp=1481&campCode=M8R).
4. Expect an interview. Camp Loma Mar LIT and CA (references and an interview) and Bear Valley CIT (every registrant is interviewed) both require one (https://www.ymcasuperiorcal.org/bearvalley).
5. Many YMCA CIT programs cost money, but aid exists. Camp Mendocino waives the fee for accepted LITs and CITs (https://www.campmendocino.org/register-for-camp); Bear Valley has Y-Assist; YMCA SF has a financial assistance application (https://www.ymcasf.org/program/overnight-summer-camps/).
6. Want to lifeguard? YMCA of Silicon Valley's Red Cross Lifeguarding course requires you to be 15 by the last class and pass a 300-yard swim, a 2-minute tread and a timed brick retrieval (https://www.ymcasv.org/lifeguard-and-safety-training).
7. Some clubs need an SSN for their background check. BGC of the Peninsula says interns and volunteers 14 and older must have a Social Security Number (https://www.bgcp.org/volunteer).
