-- Shorter, direct wording for the long violation descriptions in db/seed.sql.
-- HUMAN STEP: review, then run on the development branch (and production when approved). Not applied by any agent.
-- Matches rows by violation_id from seed.sql; sections, severity and sanctions are untouched.
UPDATE violations AS v SET description = d.description
FROM (VALUES
  (2,  $q$Not wearing, or not bringing, the University ID on campus or during official University activities off campus.$q$),
  (3,  $q$Wearing inappropriate attire on campus, such as: torn or ripped bottoms; sleeveless, spaghetti-strap, tube, halter or crop tops; plunging necklines, exposed back or midriff; shorts or skirts more than 2 inches above the knee; figure-hugging or see-through clothing; joggers, sweatpants or leggings; slippers, flip-flops, slides or open shoes; cross-dressing.$q$),
  (4,  $q$Wearing clothing with inappropriate language or suggestive graphics that go against the University's values.$q$),
  (12, $q$Dyeing hair a color the University considers inappropriate (see Appendices, Student Etiquette, item 6).$q$),
  (13, $q$Entering a restroom or area meant only for the opposite sex.$q$),
  (17, $q$Cheating or any form of academic dishonesty, online or face-to-face, in exams, quizzes, reports, papers or assignments. This includes:
- possessing unauthorized notes or materials, used or not;
- copying, or letting another student copy;
- looking at another student's paper, or letting yours be seen;
- communicating, or using an electronic device, during an exam without permission;
- plagiarism and leaking exam questions;
- having someone else take your exam or prepare your work (both parties are liable if both are students).
The faculty, proctor and college Dean decide the penalty; the case is also filed in writing with the SDO.$q$),
  (19, $q$Collecting money, checks or similar instruments for University matters without authority.$q$),
  (20, $q$Selling items, running a business or soliciting donations on campus without prior approval.$q$),
  (21, $q$Forging, falsifying or tampering with academic or official records, or making false statements or practicing fraud in any University matter.$q$),
  (22, $q$Lying under oath, or knowingly making untruthful statements in a sworn document or proceeding.$q$),
  (24, $q$Misconduct inside the class (face-to-face or online), library, laboratory or anywhere on campus, such as disrupting class on purpose through loud talking, uncontrolled laughter, whistling, heckling, unnecessary noise or provoking others.$q$),
  (25, $q$Deliberately disrupting an academic function or school activity in a way that causes disorder or serious disturbance.$q$),
  (28, $q$Assaulting any member of the administration, faculty, administrative support personnel, student or other person in authority.$q$),
  (29, $q$Provoking a heated verbal or physical confrontation between students or groups of students.$q$),
  (31, $q$Vandalism, unhygienic use or destruction of property belonging to the University, its personnel, students or visitors on campus.$q$),
  (32, $q$Preventing a recognized student publication from circulating by withholding or removing a substantial number of copies.$q$),
  (33, $q$Grossly disrespectful words or acts that ridicule or bring contempt on the University or on any administrator, faculty member, staff member, guard, student or visitor.$q$),
  (34, $q$Acts that damage the University's name, such as publicly and maliciously accusing it of a crime, vice or defect, or any act that causes it dishonor or contempt.$q$),
  (35, $q$Joining unauthorized off-campus activities in the school uniform or any part of it.$q$),
  (36, $q$Repeatedly breaking rules: three (3) minor offenses of the same kind, or four (4) minor offenses of different kinds.$q$),
  (41, $q$Entering the University or attending any school activity under the influence of alcohol or prohibited drugs.$q$),
  (42, $q$Bringing, carrying, possessing or using a deadly weapon on campus or during a school activity off campus.$q$),
  (44, $q$Threatening another person with a crime, wrong or harm to their person, honor or integrity.$q$),
  (45, $q$Trying to convert another person to your faith by attacking their beliefs or practices, or by offering special inducements.$q$),
  (49, $q$Hazing or causing physical injury as part of initiation, admission or continued membership in any group, open or secret. Members present are liable whether or not they took part; officers are also responsible.$q$),
  (51, $q$Joining, or operating on campus for, an organization not recognized by the University.$q$),
  (52, $q$Recruiting students to join a fraternity, sorority or organization not recognized by the University.$q$),
  (53, $q$Encouraging students to break their Non-Fraternity Contract by inviting them to join an unrecognized fraternity, sorority or organization.$q$),
  (55, $q$Any form of bullying as defined in Section 2 of RA 10627, the Anti-Bullying Act of 2013 (see Annex B).$q$),
  (56, $q$Any gender-based sexual harassment as defined in RA 11313 (Safe Spaces Act) and RA 7877 (Anti-Sexual Harassment Act).$q$),
  (57, $q$Bringing, carrying, possessing or using prohibited drugs or chemicals without a prescription on campus, at academic functions or off-campus activities, or any other violation of RA 9165 (Comprehensive Dangerous Drugs Act of 2002).$q$),
  (60, $q$Possessing, displaying or distributing pornographic material, including visiting pornographic sites on campus.$q$),
  (63, $q$Public displays of affection such as hugging, kissing or other overt sexual behavior.$q$),
  (66, $q$Computer security breach, such as: altering information (changing another account's password or files beyond your access), destroying information (deleting someone else's file), introducing false information (using another account to send offensive mail, cyberbullying), blocking authorized use of data, or disrupting University networks (changing PC configuration, introducing a virus).$q$),
  (67, $q$Making bomb jokes.$q$)
) AS d(violation_id, description)
WHERE v.violation_id = d.violation_id AND NOT v.is_system;
