# Bay Area city pass for issues 1 and 2 (researched 2026-10-16)

This pass covers the ten cities in GitHub issues 1 and 2: Cupertino, Santa Clara, Milpitas, Los Altos and Menlo Park (issue 1), and Hayward, San Leandro, Livermore, Pleasanton and Dublin (issue 2). Issue 2 also asked about Lawrence Livermore National Laboratory and Sandia. Programs we looked at and left out are in docs/research/bay-cities-excluded.json, each with a reason.

## What was searched
For every city: the parks and recreation jobs page and the city job board (governmentjobs.com, CalOpps or Paycom), teen volunteer pages (city, library, senior center, museum), police explorers or cadets, fire explorers, CERT, youth commissions, and any city or school district summer youth jobs.

- Cupertino: Teen Volunteer Opportunities pages (REV, Leaders in Training, Techie Teens, Youth Activity Board), Blackberry Farm aquatics, Senior Center, McClellan Ranch, the city job board. Cupertino and Los Altos Hills are policed by the Santa Clara County Sheriff, so the Sheriff Youth Cadet page was read too.
- Santa Clara: Parks and Recreation community service page (Students of Service, Summer Junior Leader), the Santa Clara City Library teen pages (the city runs its own library, separate from the county library district), the city job board, the Police Activities League Explorer page.
- Milpitas: the city volunteer program, Rec Leader page, job board, Police Explorers, Fire Explorers, Teen Academy, CERT and Teen Center.
- Los Altos and Los Altos Hills: Teen Programs, Become a Volunteer, Counselor in Training, Youth Commission Council Academy, police pages and job board; the Los Altos Hills Youth Commission and its openings list.
- Menlo Park: police cadets, Menlo Park Fire District explorers and cadets, the city aquatics page and the pool operator's careers page, CalOpps, library volunteering, Peninsula Volunteers.
- Hayward: H.A.R.D. employment page and Paycom job board, Hayward Unified's YEP Youth Professionals internship, the police Summer Youth Academy, library tutoring, CERT.
- San Leandro: Lifeguard posting, Police Explorers, Teens page and the 2025 summer guide (Counselor in Training), library teen volunteers, Youth Advisory Commission, SLUSD internships.
- Livermore: the city teen page and library Youth Council page, Police Explorers, Livermore-Pleasanton Fire explorers, LARPD jobs, job descriptions and volunteer page.
- Pleasanton: police programs page (Teen Academy, Explorers), recreation youth and teen programs (Leader in Training), library get-involved page, the city job board.
- Dublin: volunteer opportunities, Teen Academy, job board, Alameda County Library events for the Dublin branch.
- Labs: LLNL Science Education workshops (SAGE, Biotech, Manufacturing, STEM with Phones), LLNL student internships, Sandia student internships and FAQ.

## How pages were read
- Many city sites block plain fetches (santaclaraca.gov, sclibrary.org, sanleandro.org, losaltosca.gov, livermoreca.gov, the Sheriff site, menlopark.gov PDFs). These were read with a scraping service that loads the page like a browser. Los Altos needed its slower mode. Every card cites the official page it was read from.
- Job boards build their lists with JavaScript. Postings were read one by one from each posting's own page.
- Five cards were spot checked a second time against the live page (Cupertino REV, Santa Clara Recreation Leader I, Menlo Park lifeguard posting, Livermore Youth Council, LLNL Manufacturing Workshop). All matched.

## What changed on existing cards
- San Leandro library teen volunteers: the page now says winter/spring applications are open, due Dec 12, 2026. The card is now open-now with that deadline.
- The Livermore Area Youth Advisory Commission card (snippet-only before) was replaced by the Livermore Youth Council card, read on the library's own page. Same id, new name and url.

## Gaps not closed
- Paid city recreation jobs for teens with no posting open on Oct 16, 2026: Cupertino, Los Altos, Menlo Park (city jobs), San Leandro recreation leader, Pleasanton, Dublin. Recheck these boards in spring 2027, when summer jobs are posted.
- Pleasanton Library teen volunteers: every library role listed is 18 and up, and the Friends of the Library page gives no teen ages. Still open in issue 2.
- The San Leandro Youth Advisory Commission page still does not say how to apply.
- Santa Clara Summer Junior Leader costs a fee that is not posted. Add it as fee-based when the 2027 fee appears.
- Leads not researched yet: SPARC Theater high school internships and Aviation Explorer Post 997 (Livermore), Grassroots Ecology Youth Stewards (Cupertino), and H.A.R.D. job board pages 2 and 3.
- Sandia's Livermore site has its own intern office, but its high school internships use the same page as the Albuquerque card. That card could list Livermore too.

## Tips for teens in these cities (each with a source)
1. Cupertino's Recreation Event Volunteers take new members now and review applications in September, December, March and May. https://www.cupertino.gov/Parks-Recreation/Activities/Teens/Teen-Volunteer-Opportunities/Recreation-Event-Volunteers
2. Cupertino's Leaders in Training, Techie Teens and Youth Activity Board all open in February or March. Last year two of them closed March 27. https://www.cupertino.gov/Parks-Recreation/Activities/Teens/Teen-Volunteer-Opportunities
3. Santa Clara Recreation Leader I is a city job for 16 year olds who finished 10th grade, $18.70 to $21.56 an hour, with a continuous posting. https://www.governmentjobs.com/careers/cityofsantaclaraca/jobs/5272756/as-needed-recreation-leader-i-ii-iii
4. Santa Clara has its own city library, separate from the county library. Its teen volunteers must be 14 and in high school. https://www.sclibrary.org/kids-teens/teens/teen-volunteer-opportunities
5. Milpitas hires lifeguards at 15 and recreation leaders at 16. https://www.governmentjobs.com/careers/milpitas/jobs/4628055/lifeguard-swim-instructor-pt-unbenefited
6. Menlo Park's city pools are run by a contractor, so pool jobs (15 and up, $20 to $26 an hour for lifeguards) are on its job board, not the city's. https://menloswim.com/about/careers/
7. In Hayward, the park district (H.A.R.D.), not the city, hires lifeguards at 15. https://www.haywardrec.org/195/Employment
8. Hayward Unified students in grades 10 to 12 can apply for a paid after-school internship each late August. https://www.husd.us/parentsstudents/yep/student-internship
9. San Leandro library teen volunteers: apply by Dec 12, 2026 and go to the Dec 12 orientation. https://www.sanleandro.org/558/Teen-Volunteer
10. LLNL's free summer workshops for high schoolers opened Jan 19 and closed Feb 26 in 2026. Expect the same in 2027. https://st.llnl.gov/sci-ed/SAGE
11. Pleasanton teens must finish the free police Teen Academy before they can join Explorers. https://www.cityofpleasantonca.gov/our-government/police/programs-outreach/
12. Dublin city volunteer roles start at 14, and you do not have to live in Dublin. https://www.dublin.ca.gov/1402/Volunteer-Opportunities

## Warnings
- Fee-based: Los Altos Counselor in Training ($125 to $296 a week), San Leandro Counselor in Training ($150 plus $50 a session in 2025), Cupertino Leaders in Training (fee not posted), Cupertino Techie Teens ($30 if picked). None are paid jobs.
- Police cadet and explorer applications (Menlo Park, Milpitas) ask for personal details for a background check. That is normal for a police program. Give them only on the official form.
