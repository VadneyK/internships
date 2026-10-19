# Geocode report

Source: US Census Bureau Gazetteer 2026 (public domain), https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/
Files used: 2026_Gaz_place_national, 2026_Gaz_cousubs_national, 2026_Gaz_counties_national, 2026_Gaz_state_national, 2026_Gaz_zcta_national. County subdivisions are used for New England towns and township states (the places file only lists their CDPs). ZCTA (ZIP code area) centroids are used for a few neighborhoods the places file lacks.
Canada: manual table in data/geo-overrides.json from the Canadian Geographical Names Database (Natural Resources Canada).
Precision 'manual' covers both the British Columbia table and the ZIP-centroid points; each one carries its source in data/geo-overrides.json or trace.tsv. Province wide British Columbia cards are listed under noPoint.statewide with the key BC, which is a province code and not a US state.

## Counts

| What | Cards |
|---|---|
| All cards | 2777 |
| With a point | 2423 (87.3%) |
| Statewide (no point) | 188 |
| Online (no point) | 49 |
| National (no point) | 7 |
| Many places (no point) | 110 |
| Unmatched | 0 (0.00%) |

Distinct city strings: 1022. Distinct map points (cities list): 488.

Points by precision (points / cards): city 417 / 2136, county 55 / 179, manual 16 / 108

Statewide by state: AZ 1, BC 5, CA 20, CO 5, FL 3, GA 12, HI 4, IA 8, ID 2, IL 12, IN 8, KY 4, MA 7, MD 5, MI 8, MN 5, MO 4, MT 2, NC 6, ND 2, NJ 3, NM 4, NV 3, NY 4, OH 5, OR 2, PA 6, SD 2, TN 2, TX 12, UT 3, VA 5, WA 6, WI 6, WY 2

## Unmatched

None.

## Overrides

Entries in data/geo-overrides.json: byCity 72, byId 1, aliases 5, manualPoints 5. Every entry carries a reason. Entries that fired this run: 83.

## Ambiguous matches (picked by region center or land area)

- Hamilton, NJ -> Hamilton, NJ (ambiguous(2), picked nearest region center)
- St. Anthony, MN -> St. Anthony, MN (ambiguous(2), picked nearest region center)

## Distance outliers (more than 150 km from the median point of the card's own metro regions)

Listed for eyeballing; a long distance is normal for multi-state or travel programs.

None.

## Region to state map used when the city text has no state

alabama=AL, alameda=CA, alaska=AK, ann-arbor=MI, arizona=AZ, arkansas=AR, atlanta=GA, austin=TX, berkeley=CA, blacksburg=VA, bloomington=IN, boston=MA, british-columbia=BC, california=CA, champaign=IL, charlottesville=VA, chicago=IL, cincinnati=OH, college-park=MD, colorado=CO, columbus=OH, connecticut=CT, davis=CA, delaware=DE, district-of-columbia=DC, east-bay=CA, fairfax=VA, florida=FL, fremont=CA, georgia=GA, hawaii=HI, idaho=ID, illinois=IL, indiana=IN, inland-empire=CA, iowa=IA, kansas=KS, kentucky=KY, lafayette=IN, lansing=MI, los-angeles=CA, louisiana=LA, madison=WI, maine=ME, maryland=MD, massachusetts=MA, merced=CA, michigan=MI, minnesota=MN, mississippi=MS, missouri=MO, montana=MT, nebraska=NE, nevada=NV, new-brunswick=NJ, new-hampshire=NH, new-jersey=NJ, new-mexico=NM, new-york=NY, new-york-city=NY, new-york-state=NY, north-carolina=NC, north-dakota=ND, oakland=CA, ohio=OH, oklahoma=OK, orange-county=CA, oregon=OR, peninsula=CA, pennsylvania=PA, philadelphia=PA, pittsburgh=PA, puerto-rico=PR, rhode-island=RI, sacramento=CA, san-diego=CA, san-francisco=CA, san-jose=CA, santa-barbara=CA, seattle=WA, silicon-valley=CA, south-carolina=SC, south-dakota=SD, tennessee=TN, texas=TX, triangle=NC, twin-cities=MN, utah=UT, vermont=VT, virginia=VA, washington=WA, west-virginia=WV, wisconsin=WI, wyoming=WY, yolo=CA

## Method

1. Parentheticals are dropped from the city text (they name buildings, campuses or neighborhoods).
2. Text starting with Online or Virtual is online, and so is text whose parenthetical begins with online, virtual, live online or live on Zoom unless it also says in person, campus, hybrid, also, or, some, residency or academy (hybrids keep their pin). Nationwide, school chapters across the US and park lists are national. Statewide text, or a bare state name, is statewide with the state code.
3. Otherwise the first state code splits the text: the name just before it is matched to a Gazetteer place (incorporated place first, then county subdivision, then CDP), or to a county when it ends in County or Parish. St./Saint, Ft./Fort and Mt./Mount are folded together.
4. Two or more places before the state ("Fremont, Newark and Union City, CA"), a second place after it, semicolon lists, or a sub-state region are classified as multi and get no point.
5. Text with no state uses the state of the card's regions (found by majority vote among cards that do carry a state).
6. Every other hand fix is in data/geo-overrides.json with a reason. trace.tsv lists how each card was resolved.
