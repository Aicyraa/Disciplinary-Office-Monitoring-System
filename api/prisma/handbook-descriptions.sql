-- Shorter, direct wording for the long violation descriptions in db/seed.sql.
-- HUMAN STEP: review, then run on the development branch (and production when approved). Not applied by any agent.
-- Matches rows by violation_id from seed.sql; sections, severity and sanctions are untouched.
UPDATE violations AS v SET description = d.description
FROM (VALUES
  (2,  'Not wearing, or not bringing, the University ID on campus or during official University activities off campus.'),
  (3,  'Wearing inappropriate attire on campus, such as: torn or ripped bottoms; sleeveless, spaghetti-strap, tube, halter or crop tops; plunging necklines, exposed back or midriff; shorts or skirts more than 2 inches above the knee; figure-hugging or see-through clothing; joggers, sweatpants or leggings; slippers, flip-flops, slides or open shoes; cross-dressing.'),
  (4,  'Wearing clothing with inappropriate language or suggestive graphics that go against the University''s values.'),
  (12, 'Dyeing hair a color the University considers inappropriate (see Appendices, Student Etiquette, item 6).'),
  (13, 'Entering a restroom or area meant only for the opposite sex.'),
  (17, 'Cheating or any form of academic dishonesty, online or face-to-face, in exams, quizzes, reports, papers or assignments. This includes:
- possessing unauthorized notes or materials, used or not;
- copying, or letting another student copy;
- looking at another student''s paper, or letting yours be seen;
- communicating, or using an electronic device, during an exam without permission;
- plagiarism and leaking exam questions;
- having someone else take your exam or prepare your work (both parties are liable if both are students).
The faculty, proctor and college Dean decide the penalty; the case is also filed in writing with the SDO.'),
  (19, 'Collecting money, checks or similar instruments for University matters without authority.'),
  (20, 'Selling items, running a business or soliciting donations on campus without prior approval.'),
  (21, 'Forging, falsifying or tampering with academic or official records, or making false statements or practicing fraud in any University matter.'),
  (22, 'Lying under oath, or knowingly making untruthful statements in a sworn document or proceeding.'),
  (24, 'Misconduct inside the class (face-to-face or online), library, laboratory or anywhere on campus, such as disrupting class on purpose through loud talking, uncontrolled laughter, whistling, heckling, unnecessary noise or provoking others.'),
  (25, 'Deliberately disrupting an academic function or school activity in a way that causes disorder or serious disturbance.'),
  (28, 'Assaulting any member of the administration, faculty, administrative support personnel, student or other person in authority.'),
  (29, 'Provoking a heated verbal or physical confrontation between students or groups of students.'),
  (31, 'Vandalism, unhygienic use or destruction of property belonging to the University, its personnel, students or visitors on campus.'),
  (32, 'Preventing a recognized student publication from circulating by withholding or removing a substantial number of copies.'),
  (33, 'Grossly disrespectful words or acts that ridicule or bring contempt on the University or on any administrator, faculty member, staff member, guard, student or visitor.'),
  (34, 'Acts that damage the University''s name, such as publicly and maliciously accusing it of a crime, vice or defect, or any act that causes it dishonor or contempt.'),
  (35, 'Joining unauthorized off-campus activities in the school uniform or any part of it.'),
  (36, 'Repeatedly breaking rules: three (3) minor offenses of the same kind, or four (4) minor offenses of different kinds.'),
  (41, 'Entering the University or attending any school activity under the influence of alcohol or prohibited drugs.'),
  (42, 'Bringing, carrying, possessing or using a deadly weapon on campus or during a school activity off campus.'),
  (44, 'Threatening another person with a crime, wrong or harm to their person, honor or integrity.'),
  (45, 'Trying to convert another person to your faith by attacking their beliefs or practices, or by offering special inducements.'),
  (49, 'Hazing or causing physical injury as part of initiation, admission or continued membership in any group, open or secret. Members present are liable whether or not they took part; officers are also responsible.'),
  (51, 'Joining, or operating on campus for, an organization not recognized by the University.'),
  (52, 'Recruiting students to join a fraternity, sorority or organization not recognized by the University.'),
  (53, 'Encouraging students to break their Non-Fraternity Contract by inviting them to join an unrecognized fraternity, sorority or organization.'),
  (55, 'Any form of bullying as defined in Section 2 of RA 10627, the Anti-Bullying Act of 2013 (see Annex B).'),
  (56, 'Any gender-based sexual harassment as defined in RA 11313 (Safe Spaces Act) and RA 7877 (Anti-Sexual Harassment Act).'),
  (57, 'Bringing, carrying, possessing or using prohibited drugs or chemicals without a prescription on campus, at academic functions or off-campus activities, or any other violation of RA 9165 (Comprehensive Dangerous Drugs Act of 2002).'),
  (60, 'Possessing, displaying or distributing pornographic material, including visiting pornographic sites on campus.'),
  (63, 'Public displays of affection such as hugging, kissing or other overt sexual behavior.'),
  (66, 'Computer security breach, such as: altering information (changing another account''s password or files beyond your access), destroying information (deleting someone else''s file), introducing false information (using another account to send offensive mail, cyberbullying), blocking authorized use of data, or disrupting University networks (changing PC configuration, introducing a virus).'),
  (67, 'Making bomb jokes.')
) AS d(violation_id, description)
WHERE v.violation_id = d.violation_id AND NOT v.is_system;
