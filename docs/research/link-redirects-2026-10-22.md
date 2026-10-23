# Card links that redirect (2026-10-22)

One pass over the `url` of the 413 California cards that are not closed (Bay Area, Southern California, Sacramento, Davis and statewide). Each address was requested with curl (follow redirects, 20 second limit, 6 at a time) and the final address compared with the card.

Status codes: 000: 7, 200: 323, 403: 81, 406: 2. Almost all 403, 406 and 000 answers are sites that refuse scripted requests; many of those pages were read in a browser on Oct 21 and 22 and work. They are not broken links.

## Redirects to a different page (28)

Most are the same program at a new address. A redirect still works, so no card was changed for that alone. When a card is next re-read, its `url` can move to the new address.

| card id | card url | lands on | note |
|---|---|---|---|
| alameda-county-community-food-bank-volunteer | https://www.accfb.org/volunteer/ | https://www.accfb.org/give/volunteer/ | same program, new address (#92) |
| alameda-high-school-cte-pathways | https://ahs.alamedaunified.org/fs/pages/5185 | https://ahs.alamedaunified.org/academics/career-technical-education | same program, new address |
| berkeley-youthworks | https://berkeleyca.gov/youthworks | https://berkeleyca.gov/community-recreation/community-services/youthworks | same program, new address |
| chabot-dual-enrollment | https://chabotcollege.edu/academics/early-college/new-student.php | https://chabotcollege.edu/earlycollege/ | new Early College overview; the card matches the IDE page (#92) |
| congressional-app-challenge | https://www.congressionalappchallenge.us/rules/ | https://www.congressionalappchallenge.us/students/rules/ | same program, new address |
| csssa-california-state-summer-school-arts | https://www.csssa.ca.gov/how-to-apply/ | https://www.csssa.ca.gov/admissions/how-to-apply/ | same program, new address |
| deca-california | https://www.deca.org/about | https://www.deca.org/mission | same program, new address |
| evergreen-valley-college-dual-enrollment | https://www.evc.edu/programs-academics/academic-resources/dual-enrollment | https://www.evc.edu/academics/dual-enrollment/index.html | same program, new address |
| genesys-works-bay-area | https://www.genesysworks.org/bay-area | https://genesysworks.org/locations/bay-area/ | same program, new address |
| habitat-east-bay-silicon-valley-volunteer | https://www.habitatebsv.org/volunteer/ | https://www.habitatebsv.org/get-involved | same program, new address |
| key-club-high-school | https://www.keyclub.org/how-it-works | https://www.keyclub.org/why-key-club/how-it-works/ | same program, new address |
| lbwin-youth-career-services-center | https://longbeach.gov/economicdevelopment/talent-workforce/youth-services/ | https://longbeach.gov/edo/talent-workforce/youth-services/ | same program, new address |
| long-beach-city-college-individual-dual-enrollment | https://www.lbcc.edu/dual-enrollment | https://www.lbcc.edu/post/individual-dual-enrollment-ide | same program, new address |
| los-angeles-petersen-teen-auto-workshop | https://petersen.org/teen-auto-workshop | https://petersen.org/pages/teen-auto-workshop | same program, new address |
| march-field-air-museum-junior-docents | https://www.marchfield.org/support/volunteer | https://www.marchfield.org/volunteer/ | same program, new address |
| mission-college-high-school-dual-enrollment | https://missioncollege.edu/student_services/outreach/hs-students.html | https://missioncollege.edu/office-of-instruction/educational-partnerships/dual-enrollment.html | same program, new address |
| oc-fair-seasonal-jobs | https://ocfair.com/jobs | https://ocfair.com/about-us/employment/ | same program, new address |
| oakland-zoo-teen-wild-guides | https://www.oaklandzoo.org/support/volunteer/teen-wild-guides | https://www.oaklandzoo.org/teen-wild-guides/ | same program, new address (#91) |
| oakland-public-library-teen-volunteer | https://oaklandlibrary.org/teenvolunteers | https://oaklandlibrary.org/teens/teen-volunteers/ | same program, new address (#91) |
| ocwdb-ready-set-oc-young-adult | https://workforce.oc.gov/oc-workforce-development-board/ready-set-oc | https://workforce.oc.gov/career-services/youth-programs | READY S.E.T. still listed (ages 16 to 24) on the new page |
| ousd-linked-learning-work-based-learning | https://www.ousd.org/linkedlearning | https://www.ousd.org/high-school-linked-learning-office | same program, new address |
| san-diego-workforce-partnership-youth | https://workforce.org/c2csd | https://workforce.org/getajob | now a general job page for ages 16 to 24; the card is already unconfirmed |
| santa-barbara-sea-center-volunteer-interpreter | https://www.sbnature.org/volunteer/adult/sea-center-opportunities/ | https://www.sbnature.org/volunteer/sea-center-opportunities | same program, new address |
| sbceo-county-superintendent-student-advisory-council | https://www.sbceo.org/fs/pages/1031 | https://sbceoorg-28-us-west1-01.preview.finalsitecdn.com/student-advisory-council | lands on a site-builder preview host; the old address should be checked by hand |
| scripps-health-volunteer-ages-15-plus | https://www.scripps.org/about-us__volunteer | https://www.scripps.org/about-us/volunteer | same program, new address |
| sf-rec-park-yep | https://sfrecpark.org/workreation | https://www.sfrecpark.org/1182/Youth-Employment-Programs | same program, new address |
| slac-regional-science-bowl-high-school | https://www6.slac.stanford.edu/science-bowl | https://www6.slac.stanford.edu/news-and-events/events/science-bowl | same program, new address |
| tech-interactive-teen-holiday-helper | https://www.thetech.org/support-us/volunteer | https://www.thetech.org/support/volunteer-innovator-program/ | fixed in this pass (url and status) |
