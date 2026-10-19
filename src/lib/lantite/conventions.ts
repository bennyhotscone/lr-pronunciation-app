import { question } from "@/lib/lantite/question";
import type { LantitePassage, LantiteQuestion } from "@/lib/lantite/types";

export const CONVENTION_PASSAGES: readonly LantitePassage[] = [
  {
    id: "p-c-set",
    title: "Campus results note",
    textType: "workplace-email",
    text: `Subject: Campus results

Hello,

The set of results from the two campuses are ready for you to review on Thursday. I have left both files in the shared folder. Please tell me if Thursday still suits you.

Thanks,
Jordan`,
  },
  {
    id: "p-c-quality",
    title: "Report quality",
    textType: "workplace-email",
    text: `Newsletter line, not yet published

The quality of the student reports have improved since the checklist was introduced. Teachers say the checklist made the expected sections easier to see. This line still needs a check before it goes into the newsletter.`,
  },
  {
    id: "p-c-there",
    title: "Draft issues",
    textType: "policy-extract",
    text: `From a draft attendance procedure

There is several issues in the attendance draft that the coordinator still needs to check. The draft covers late arrivals, explained absences and who signs the weekly summary. The opening line is the one that still needs work.`,
  },
  {
    id: "p-c-number",
    title: "Absence count",
    textType: "statistical-report",
    text: `Term attendance note

The number of unexplained absences have risen since the start of term. The count includes absences with no parent message within five school days. The figure is ready for the report once the sentence is sound.`,
  },
  {
    id: "p-c-sam",
    title: "Timetable email",
    textType: "workplace-email",
    text: `Email still being edited

When Sam emailed Alex the timetable, he asked for a reply the same day. The timetable covers Tuesday to Friday. A reader should be able to tell which person asked for the reply.`,
  },
  {
    id: "p-c-this",
    title: "Coordinator note",
    textType: "workplace-email",
    text: `Note for the year-level file

The attendance rate fell and the survey response rose. This concerned the coordinator. The note is meant to record a concern about attendance, not about the survey. The second sentence should name that concern.`,
  },
  {
    id: "p-c-although",
    title: "Notice fragment",
    textType: "public-notice",
    text: `Line from a household notice

Although the notice explained the change to bin day. The notice was meant to warn households that missed the new collection day. As it stands, the opening does not finish the thought it starts.`,
  },
  {
    id: "p-c-splice",
    title: "Bin warning",
    textType: "public-notice",
    text: `Line from a council warning

The bins were contaminated, the council issued a warning. Soft plastics had been left in the yellow bins after the education period. The two facts need a proper join before the notice is posted.`,
  },
  {
    id: "p-c-dangling",
    title: "Policy reading",
    textType: "policy-extract",
    text: `Line from a policy meeting note

Walking through the policy, the date of the review was unclear. The coordinator was the person moving through the document. The sentence should show who was walking, and what that person found.`,
  },
  {
    id: "p-c-its",
    title: "Returning forms",
    textType: "workplace-email",
    text: `Reminder to families

Its time to return the forms, and the office wants it's copy filed today. Families keep one copy at home. The office copy should be clearly marked as belonging to the office.`,
  },
  {
    id: "p-c-restrict",
    title: "Late arrival",
    textType: "policy-extract",
    text: `Two drafts of the late-arrival rule are being compared. Only students who arrive after 9 am are meant to sign in. Students who arrive on time are not included.

Draft A: Students who arrive after 9 am must sign in.
Draft B: Students, who arrive after 9 am, must sign in.`,
  },
  {
    id: "p-c-colon",
    title: "What to bring",
    textType: "public-notice",
    text: `Sports-day reminder for families

Please bring: a hat, a full water bottle and the signed notice. The list is the only reminder families will see about what to pack. The line should introduce that list clearly.`,
  },
  {
    id: "p-c-possess",
    title: "Classroom books",
    textType: "workplace-email",
    text: `Note about the class novels

Please collect the students books from the tub before home time. The novels are shared by the class and belong to the students as a group, not to one student. The line needs to show that group ownership.`,
  },
  {
    id: "p-c-practise",
    title: "Speech rehearsal",
    textType: "workplace-email",
    text: `Note home about Friday’s speech session

Friday has a speech session at lunch. Students are also being asked to work on the opening at home tonight. The note must use Australian spelling: the noun for the session itself, and the verb for the action of rehearsing.`,
  },
  {
    id: "p-c-affect",
    title: "Timetable change",
    textType: "workplace-email",
    text: `Staff note about a timetable change

The change may influence the roster. The result of that change was a shorter lunch. The note needs one word as a verb for “influence”, and a different word as a noun for “result”.`,
  },
  {
    id: "p-c-complement",
    title: "Paired texts",
    textType: "academic-passage",
    text: `A diagram and a paragraph are used together in the same lesson. Each one completes what the other does not cover. The sentence you choose should describe that partnership. It should not suggest praise, a free gift, or that the diagram is flattering the paragraph.`,
  },
  {
    id: "p-c-principal",
    title: "School rule",
    textType: "policy-extract",
    text: `Attendance policy — sentence for the parent handbook

The handbook needs one sentence in the attendance section. It should say that the person in charge of the school explained the guiding idea behind the attendance rule. The person is the head of the school. The idea is the rule the policy is based on.`,
  },
  {
    id: "p-c-stationery",
    title: "Store room",
    textType: "workplace-email",
    text: `Request for the office

The office needs paper and envelopes for next week’s notes home. The same message should also record that the delivery van was stopped, and not moving, for an hour. One word names the paper supplies. The other word names the van that was not moving.`,
  },
  {
    id: "p-c-register",
    title: "Casual draft",
    textType: "public-notice",
    text: `Draft for a family notice about late pickup

Hey guys, the pickup rule is kinda strict so don't bother the office if you're late, just sneak in the side door.

The notice is for families. It should tell them what to do if they arrive after 3:20 pm. The wording needs to be polite, specific and possible to follow.`,
  },
  {
    id: "p-c-topic",
    title: "Library paragraph",
    textType: "opinion-column",
    text: `A writer has these four sentences and needs them in an order that reads as one paragraph.

1. The classroom box holds a smaller set of titles.
2. The school library now closes at 3:10 pm.
3. Students who miss that time can still borrow from the classroom box.
4. Even so, the shorter hours have cut the range of books most students see.`,
  },
  {
    id: "p-c-however",
    title: "Borrowing contrast",
    textType: "public-notice",
    text: `Library notice

The library is closed after school. The next sentence should mark a real contrast with that closing. A contrast would offer something different, such as another way to borrow. It would not repeat that the library is shut.`,
  },
  {
    id: "p-c-fewer",
    title: "Complaint count",
    textType: "statistical-report",
    text: `Term summary

The school is reporting a drop in the number of written complaints. Each complaint is being counted one by one. The sentence should fit that smaller count. It should not treat the complaints as an amount of liquid, and it should not judge how important they are.`,
  },
  {
    id: "p-c-imply",
    title: "Reader and writer",
    textType: "academic-passage",
    text: `Comment on a parent notice

The notice hints at a stricter rule in its last sentence. The reader is the person who works that hint out. A comment on the notice should give the hinting to the notice and the working-out to the reader.`,
  },
  {
    id: "p-c-whose",
    title: "Draft ownership",
    textType: "workplace-email",
    text: `A question in the staffroom

A teacher is holding a draft and wants to ask which person it belongs to. The question is about ownership of that draft. It is not a question about whether someone is standing at the door.`,
  },
];

export const CONVENTION_QUESTIONS: readonly LantiteQuestion[] = [
  question({
    id: "q-c-set",
    passageId: "p-c-set",
    skill: "subject-verb-agreement",
    category: "conventions",
    difficulty: "standard",
    tags: ["agreement", "set"],
    pitfall: { id: "agreement-intervening", label: "Letting a nearby noun choose the verb" },
    stem: "Which revision agrees in number?",
    options: [
      "The set of results from the two campuses is ready for you to review on Thursday.",
      "The set of results from the two campuses are ready for you to review on Thursday.",
      "The set of results from the two campuses were ready for you to review on Thursday.",
      "The set of results from the two campuses have been ready for you to review on Thursday.",
    ],
    correctIndex: 0,
    explanation:
      "The subject is ‘set’, which is singular. ‘Of results from the two campuses’ modifies that subject and does not make it plural.",
    optionWhy: [
      "Correct. A singular subject, ‘set’, takes ‘is’.",
      "‘Are’ agrees with ‘campuses’ or ‘results’, not with the real subject, ‘set’.",
      "‘Were’ is still a plural verb, and it also shifts the note into the past without reason.",
      "‘Have been’ is plural. The subject ‘set’ needs a singular verb.",
    ],
  }),
  question({
    id: "q-c-quality",
    passageId: "p-c-quality",
    skill: "subject-verb-agreement",
    category: "conventions",
    difficulty: "easy",
    tags: ["agreement", "quality"],
    pitfall: { id: "agreement-intervening", label: "Letting a nearby noun choose the verb" },
    stem: "Which revision agrees in number?",
    options: [
      "The quality of the student reports has improved since the checklist was introduced.",
      "The quality of the student reports have improved since the checklist was introduced.",
      "The quality of the student reports were improved since the checklist was introduced.",
      "The quality of the student reports have been improving since the checklist was introduced.",
    ],
    correctIndex: 0,
    explanation: "The subject is ‘quality’, a singular noun. The plural ‘reports’ sits inside a modifying phrase.",
    optionWhy: [
      "Correct. ‘Quality’ takes the singular ‘has improved’.",
      "‘Have’ matches ‘reports’, which is not the subject.",
      "‘Were’ is plural and also changes the meaning towards a passive event.",
      "‘Have been’ remains plural, so it still disagrees with ‘quality’.",
    ],
  }),
  question({
    id: "q-c-there",
    passageId: "p-c-there",
    skill: "subject-verb-agreement",
    category: "conventions",
    difficulty: "easy",
    tags: ["agreement", "there"],
    pitfall: { id: "there-is-plural", label: "Using ‘there is’ before a plural subject" },
    stem: "Which revision agrees in number?",
    options: [
      "There are several issues in the attendance draft that the coordinator still needs to check.",
      "There is several issues in the attendance draft that the coordinator still needs to check.",
      "There was several issues in the attendance draft that the coordinator still needs to check.",
      "There is a several issue in the attendance draft that the coordinator still needs to check.",
    ],
    correctIndex: 0,
    explanation: "After ‘there’, the verb agrees with the real subject, ‘issues’, which is plural.",
    optionWhy: [
      "Correct. ‘Issues’ is plural, so the verb is ‘are’.",
      "‘Is’ is singular and does not agree with ‘several issues’.",
      "‘Was’ is singular, and it also moves a current draft into the past.",
      "‘A several issue’ is not grammatical, and the verb is still singular.",
    ],
  }),
  question({
    id: "q-c-number",
    passageId: "p-c-number",
    skill: "subject-verb-agreement",
    category: "conventions",
    difficulty: "standard",
    tags: ["agreement", "number"],
    pitfall: { id: "agreement-intervening", label: "Letting a nearby noun choose the verb" },
    stem: "Which revision agrees in number?",
    options: [
      "The number of unexplained absences has risen since the start of term.",
      "The number of unexplained absences have risen since the start of term.",
      "The number of unexplained absences are rising since the start of term.",
      "The number of unexplained absences were risen since the start of term.",
    ],
    correctIndex: 0,
    explanation: "The subject is ‘number’, which is singular, even though ‘absences’ is plural.",
    optionWhy: [
      "Correct. ‘The number’ takes ‘has risen’.",
      "‘Have’ agrees with ‘absences’, not with ‘number’.",
      "‘Are’ is plural, and ‘are rising since’ is also an awkward tense for a period that began in the past.",
      "‘Were risen’ is not a standard verb form, and it does not agree with ‘number’.",
    ],
  }),
  question({
    id: "q-c-sam",
    passageId: "p-c-sam",
    skill: "pronoun-reference",
    category: "conventions",
    difficulty: "standard",
    tags: ["pronoun", "ambiguity"],
    pitfall: { id: "ambiguous-pronoun", label: "Leaving a pronoun with two possible nouns" },
    stem: "Which revision makes it clear who asked for the reply?",
    options: [
      "When Sam emailed Alex the timetable, Sam asked for a reply the same day.",
      "When Sam emailed Alex the timetable, he asked for a reply the same day.",
      "When Sam emailed Alex the timetable, they asked for a reply the same day.",
      "Emailing the timetable, a reply the same day was requested.",
    ],
    correctIndex: 0,
    explanation: "‘He’ could mean Sam or Alex. Repeating the name shows that Sam made the request.",
    optionWhy: [
      "Correct. The name removes the choice between Sam and Alex.",
      "‘He’ still has two possible antecedents, so the reader cannot tell who asked.",
      "‘They’ can still point to either person, or to both, so the request stays unclear.",
      "The opening modifier has nothing clear to modify, and the sentence hides who made the request.",
    ],
  }),
  question({
    id: "q-c-this",
    passageId: "p-c-this",
    skill: "pronoun-reference",
    category: "conventions",
    difficulty: "challenging",
    tags: ["reference", "this"],
    pitfall: { id: "vague-this", label: "Using ‘this’ without a clear referent" },
    stem: "Which revision makes the coordinator’s concern specific?",
    options: [
      "The attendance rate fell and the survey response rose. The fall in attendance concerned the coordinator.",
      "The attendance rate fell and the survey response rose. This concerned the coordinator.",
      "The attendance rate fell and the survey response rose. It concerned the coordinator.",
      "This concerned the coordinator. The attendance rate fell and the survey response rose.",
    ],
    correctIndex: 0,
    explanation: "‘This’ could mean the fall, the rise, or both facts together. Naming the fall in attendance removes that choice.",
    optionWhy: [
      "Correct. The concern is tied to one named change.",
      "‘This’ still has no single referent.",
      "‘It’ is as unclear as ‘this’. Either change, or the pair, could be the concern.",
      "Moving ‘this’ earlier makes the referent even later. The reader still cannot tell which fact is meant.",
    ],
  }),
  question({
    id: "q-c-although",
    passageId: "p-c-although",
    skill: "sentence-structure",
    category: "conventions",
    difficulty: "easy",
    tags: ["fragment", "although"],
    pitfall: { id: "sentence-fragment", label: "Leaving a subordinate clause as a sentence" },
    stem: "Which revision is a complete sentence?",
    options: [
      "Although the notice explained the change to bin day, several households missed it.",
      "Although the notice explained the change to bin day.",
      "Although the notice explained the change to bin day, which was posted.",
      "The notice explained. Although the change to bin day.",
    ],
    correctIndex: 0,
    explanation: "‘Although’ begins a dependent clause. The sentence needs an independent clause after it.",
    optionWhy: [
      "Correct. The second clause can stand alone, so the sentence is complete.",
      "This is only a dependent clause. It has no main clause.",
      "‘Which was posted’ adds another dependent piece. There is still no main clause.",
      "The second part is still a fragment, and the full stop does not give it a verb of its own.",
    ],
  }),
  question({
    id: "q-c-splice",
    passageId: "p-c-splice",
    skill: "sentence-structure",
    category: "conventions",
    difficulty: "standard",
    tags: ["comma-splice"],
    pitfall: { id: "comma-splice", label: "Joining two sentences with only a comma" },
    stem: "Which revision joins the two ideas correctly?",
    options: [
      "The bins were contaminated, so the council issued a warning.",
      "The bins were contaminated, the council issued a warning.",
      "The bins were contaminated, so the council issued a warning, and they were contaminated.",
      "The bins were contaminated so, the council issued a warning.",
    ],
    correctIndex: 0,
    explanation: "Two independent clauses need more than a comma. ‘So’ supplies the missing link and keeps the cause and the warning in order.",
    optionWhy: [
      "Correct. The conjunction ‘so’ joins the clauses and states the relationship.",
      "A comma alone cannot join two full sentences. This is a comma splice.",
      "The extra clause repeats the contamination and makes the sentence clumsy without fixing a new problem.",
      "The comma is placed after ‘so’ rather than between the clauses, so the join is still wrong.",
    ],
  }),
  question({
    id: "q-c-dangling",
    passageId: "p-c-dangling",
    skill: "sentence-structure",
    category: "conventions",
    difficulty: "challenging",
    tags: ["modifier"],
    pitfall: { id: "dangling-modifier", label: "Leaving a modifier next to the wrong noun" },
    stem: "Which revision makes clear who was walking through the policy?",
    options: [
      "Walking through the policy, the coordinator found that the review date was unclear.",
      "Walking through the policy, the date of the review was unclear.",
      "Walking through the policy, the date was unclear to the review.",
      "The date of the review, walking through the policy, was unclear.",
    ],
    correctIndex: 0,
    explanation: "An opening ‘walking’ phrase should be followed by the person who walked. A date cannot walk through a policy.",
    optionWhy: [
      "Correct. ‘The coordinator’ is the person doing the walking.",
      "The date is the grammatical subject, so the sentence says the date was walking.",
      "The date is still the walker, and ‘unclear to the review’ does not repair that.",
      "‘Walking’ now seems to modify the date, which cannot walk.",
    ],
  }),
  question({
    id: "q-c-its",
    passageId: "p-c-its",
    skill: "punctuation",
    category: "conventions",
    difficulty: "easy",
    tags: ["apostrophe", "its"],
    pitfall: { id: "its-its", label: "Confusing its and it’s" },
    stem: "Which revision uses the apostrophes correctly?",
    options: [
      "It’s time to return the forms, and the office wants its copy filed today.",
      "Its time to return the forms, and the office wants it’s copy filed today.",
      "Its time to return the forms, and the office wants its copy filed today.",
      "It’s time to return the forms, and the office wants it’s copy filed today.",
    ],
    correctIndex: 0,
    explanation: "‘It’s’ means ‘it is’. ‘Its’ is the possessive form and takes no apostrophe.",
    optionWhy: [
      "Correct. ‘It’s time’ means ‘it is time’, and ‘its copy’ shows possession.",
      "Both words are swapped. ‘Its time’ does not mean ‘it is time’, and ‘it’s copy’ does not show possession.",
      "‘Its time’ should be ‘it is time’. The possessive ‘its copy’ is right, but the first word is not.",
      "‘It’s time’ is right, but ‘it’s copy’ means ‘it is copy’, which is not possession.",
    ],
  }),
  question({
    id: "q-c-restrict",
    passageId: "p-c-restrict",
    skill: "punctuation",
    category: "conventions",
    difficulty: "challenging",
    tags: ["commas", "restrictive"],
    pitfall: { id: "restrictive-commas", label: "Putting commas around information that limits the noun" },
    stem: "Which sentence says that only students who arrive after 9 am must sign in?",
    options: [
      "Students who arrive after 9 am must sign in.",
      "Students, who arrive after 9 am, must sign in.",
      "Students who arrive after 9 am, must sign in.",
      "Students, who arrive after 9 am must sign in.",
    ],
    correctIndex: 0,
    explanation: "Without commas, ‘who arrive after 9 am’ limits which students are meant. Commas would make the clause extra information about students in general.",
    optionWhy: [
      "Correct. The clause restricts the group, so only late arrivals must sign in.",
      "The commas make the clause non-restrictive, which implies that students in general arrive after 9 am and must sign in.",
      "The comma after the clause splits the subject from the verb. The restriction itself does not need that comma.",
      "One comma, and not a pair, leaves the clause neither clearly restrictive nor clearly extra.",
    ],
  }),
  question({
    id: "q-c-colon",
    passageId: "p-c-colon",
    skill: "punctuation",
    category: "conventions",
    difficulty: "standard",
    tags: ["colon", "list"],
    pitfall: { id: "colon-after-verb", label: "Putting a colon straight after a verb" },
    stem: "Which revision introduces the list correctly?",
    options: [
      "Please bring the following: a hat, a full water bottle and the signed notice.",
      "Please bring: a hat, a full water bottle and the signed notice.",
      "Please bring the following; a hat, a full water bottle and the signed notice.",
      "Please bring the following a hat, a full water bottle and the signed notice.",
    ],
    correctIndex: 0,
    explanation: "A colon should follow a complete introduction. ‘Please bring the following’ can stand before the list. ‘Please bring’ cannot.",
    optionWhy: [
      "Correct. The clause before the colon is complete, and the colon introduces the list.",
      "The colon sits between the verb and its objects. That introduction is not a complete clause.",
      "A semicolon joins related sentences. It does not introduce this list.",
      "Without punctuation, the list runs into the introduction and is harder to see.",
    ],
  }),
  question({
    id: "q-c-possess",
    passageId: "p-c-possess",
    skill: "punctuation",
    category: "conventions",
    difficulty: "standard",
    tags: ["apostrophe", "plural"],
    pitfall: { id: "plural-possession", label: "Missing the apostrophe on a plural possessive" },
    stem: "The books belong to the students as a group. Which revision shows that?",
    options: [
      "Please collect the students’ books from the tub before home time.",
      "Please collect the student’s books from the tub before home time.",
      "Please collect the students books from the tub before home time.",
      "Please collect the students’s books from the tub before home time.",
    ],
    correctIndex: 0,
    explanation: "A plural noun ending in s takes an apostrophe after the s to show possession: students’ books.",
    optionWhy: [
      "Correct. The apostrophe after s shows that more than one student owns the books.",
      "‘Student’s’ is singular. It would mean the books of one student.",
      "Without an apostrophe, ‘students’ is only a plural noun placed beside ‘books’. It does not clearly show possession.",
      "‘Students’s’ adds an extra s. The usual plural possessive is students’.",
    ],
  }),
  question({
    id: "q-c-practise",
    passageId: "p-c-practise",
    skill: "spelling-confused-words",
    category: "conventions",
    difficulty: "standard",
    tags: ["practise", "australian"],
    pitfall: { id: "practice-practise", label: "Confusing the noun practice with the verb practise" },
    stem: "Which sentence uses Australian spelling for the noun and the verb?",
    options: [
      "Friday’s practice is at lunch, so please practise the opening tonight.",
      "Friday’s practise is at lunch, so please practice the opening tonight.",
      "Friday’s practise is at lunch, so please practise the opening tonight.",
      "Friday’s practice is at lunch, so please practice the opening tonight.",
    ],
    correctIndex: 0,
    explanation: "In Australian English, ‘practice’ is the noun and ‘practise’ is the verb.",
    optionWhy: [
      "Correct. ‘Practice’ names the session, and ‘practise’ is the action.",
      "The noun and the verb are swapped.",
      "‘Practise’ is used as a noun here, which does not match Australian spelling.",
      "The noun is right, but the verb should be ‘practise’ in Australian English.",
    ],
  }),
  question({
    id: "q-c-affect",
    passageId: "p-c-affect",
    skill: "spelling-confused-words",
    category: "conventions",
    difficulty: "easy",
    tags: ["affect", "effect"],
    pitfall: { id: "affect-effect", label: "Confusing affect and effect" },
    stem: "Which pair uses the words correctly?",
    options: [
      "The change may affect the roster. The effect was a shorter lunch.",
      "The change may effect the roster. The affect was a shorter lunch.",
      "The change may affect the roster. The affect was a shorter lunch.",
      "The change may effect the roster. The effect was a shorter lunch.",
    ],
    correctIndex: 0,
    explanation: "‘Affect’ is the verb meaning to influence. ‘Effect’ is the noun meaning the result.",
    optionWhy: [
      "Correct. The verb is ‘affect’ and the noun is ‘effect’.",
      "Both words are in the wrong job. ‘Effect’ is not the verb needed here, and ‘affect’ is not the noun.",
      "The verb is right, but ‘the affect’ should be ‘the effect’ when a result is named.",
      "The noun is right, but ‘may effect the roster’ is the wrong verb for ‘influence’ in this note.",
    ],
  }),
  question({
    id: "q-c-complement",
    passageId: "p-c-complement",
    skill: "spelling-confused-words",
    category: "conventions",
    difficulty: "challenging",
    tags: ["complement"],
    pitfall: { id: "complement-compliment", label: "Confusing complement and compliment" },
    stem: "Which sentence fits two texts that work together?",
    options: [
      "The diagram and the paragraph play complementary roles.",
      "The diagram and the paragraph play complimentary roles.",
      "The diagram and the paragraph play complementing roles of praise.",
      "The diagram paid the paragraph a complement.",
    ],
    correctIndex: 0,
    explanation: "‘Complementary’ means completing something else. ‘Complimentary’ means praising or free of charge.",
    optionWhy: [
      "Correct. The roles complete each other.",
      "‘Complimentary’ would mean the roles are flattering or free, which is not the intended meaning.",
      "‘Praise’ pulls the sentence towards compliments, and ‘complementing roles of praise’ is not the clear term.",
      "A diagram does not praise a paragraph, and ‘complement’ as a noun does not mean a compliment.",
    ],
  }),
  question({
    id: "q-c-principal",
    passageId: "p-c-principal",
    skill: "spelling-confused-words",
    category: "conventions",
    difficulty: "standard",
    tags: ["principal", "principle"],
    pitfall: { id: "principal-principle", label: "Confusing principal and principle" },
    stem: "Which sentence matches a head of school explaining a rule?",
    options: [
      "The principal explained the principle behind the attendance rule.",
      "The principle explained the principal behind the attendance rule.",
      "The principal explained the principal behind the attendance rule.",
      "The principle explained the principle behind the attendance rule.",
    ],
    correctIndex: 0,
    explanation: "‘Principal’ can mean the head of a school. ‘Principle’ means a rule or guiding idea.",
    optionWhy: [
      "Correct. The person is the principal, and the idea is the principle.",
      "This swaps the person and the idea.",
      "The second ‘principal’ would mean the main part or another person, not the guiding idea.",
      "A principle cannot explain a principle in this sentence. The subject needs to be the person.",
    ],
  }),
  question({
    id: "q-c-stationery",
    passageId: "p-c-stationery",
    skill: "spelling-confused-words",
    category: "conventions",
    difficulty: "standard",
    tags: ["stationery"],
    pitfall: { id: "stationary-stationery", label: "Confusing stationary and stationery" },
    stem: "Which sentence uses both words correctly?",
    options: [
      "Please order stationery, and note that the van was stationary for an hour.",
      "Please order stationary, and note that the van was stationery for an hour.",
      "Please order stationery, and note that the van was stationery for an hour.",
      "Please order stationary, and note that the van was stationary for an hour.",
    ],
    correctIndex: 0,
    explanation: "‘Stationery’ means paper and writing supplies. ‘Stationary’ means not moving.",
    optionWhy: [
      "Correct. Supplies are stationery, and the stopped van is stationary.",
      "The two spellings are swapped.",
      "The order is right, but a van is not ‘stationery’ when it is stopped.",
      "The van is right, but paper supplies are not ‘stationary’.",
    ],
  }),
  question({
    id: "q-c-register",
    passageId: "p-c-register",
    skill: "register-word-choice",
    category: "conventions",
    difficulty: "easy",
    tags: ["register", "families"],
    pitfall: { id: "casual-register", label: "Using chat language in a formal notice" },
    stem: "Which revision is appropriate for a notice to families?",
    options: [
      "If you arrive after 3:20 pm, please come to the office and sign the late book.",
      "Hey guys, the pickup rule is kinda strict, so don’t bother the office.",
      "If you’re late, just sneak in the side door and hope nobody notices.",
      "Don’t bug the office staff, yeah, the rule is pretty harsh.",
    ],
    correctIndex: 0,
    explanation: "A family notice should be polite, specific and possible to follow. It should not invite people to ignore the office.",
    optionWhy: [
      "Correct. The tone is calm, and the action is clear.",
      "‘Hey guys’, ‘kinda’ and ‘don’t bother’ are too casual and tell families not to use the proper process.",
      "Asking families to sneak in is both the wrong register and the wrong instruction.",
      "‘Bug’, ‘yeah’ and ‘harsh’ talk down the rule instead of stating what to do.",
    ],
  }),
  question({
    id: "q-c-topic",
    passageId: "p-c-topic",
    skill: "cohesion-paragraph",
    category: "conventions",
    difficulty: "challenging",
    tags: ["order", "paragraph"],
    pitfall: { id: "paragraph-order", label: "Starting a paragraph away from its topic" },
    stem: "Which order makes the most coherent paragraph?",
    options: [
      "2, 3, 1, 4",
      "1, 4, 2, 3",
      "4, 1, 3, 2",
      "3, 1, 4, 2",
    ],
    correctIndex: 0,
    explanation:
      "The paragraph should open with the new closing time, then the alternative, then the limit of that alternative, then the consequence for the range of books.",
    optionWhy: [
      "Correct. Closing time, then the classroom alternative, then how small that set is, then the effect on range.",
      "This starts with the classroom box before the reader knows why it matters, and ‘even so’ arrives before the hours.",
      "Sentence 4’s ‘even so’ needs an earlier contrast. Starting there leaves the link hanging.",
      "Sentence 3’s ‘that time’ has no time to point back to if sentence 2 comes last.",
    ],
  }),
  question({
    id: "q-c-however",
    passageId: "p-c-however",
    skill: "cohesion-paragraph",
    category: "conventions",
    difficulty: "standard",
    tags: ["however", "contrast"],
    pitfall: { id: "false-contrast", label: "Using a contrast word without a contrast" },
    stem: "The library is closed after school. Which sentence is the best follow-up?",
    options: [
      "However, students can still borrow from the classroom box.",
      "However, the library is closed after school.",
      "However, students are also unable to borrow from the classroom box.",
      "However, closing after school means the library is shut.",
    ],
    correctIndex: 0,
    explanation: "‘However’ signals a contrast. An alternative way to borrow contrasts with the library being closed.",
    optionWhy: [
      "Correct. The classroom box is a real alternative to the closed library.",
      "This repeats the same fact, so there is no contrast for ‘however’ to mark.",
      "Losing the classroom box as well continues the problem. It is not a contrast.",
      "This restates the closing in different words. ‘However’ has nothing to turn against.",
    ],
  }),
  question({
    id: "q-c-fewer",
    passageId: "p-c-fewer",
    skill: "spelling-confused-words",
    category: "conventions",
    difficulty: "easy",
    tags: ["fewer", "less"],
    pitfall: { id: "fewer-less", label: "Using less with a countable plural" },
    stem: "Which sentence fits a drop in the number of complaints?",
    options: [
      "The school received fewer complaints this term.",
      "The school received less complaints this term.",
      "The school received fewer complaint this term.",
      "The school received lesser complaints this term, meaning a smaller count.",
    ],
    correctIndex: 0,
    explanation: "‘Fewer’ is used with countable plural nouns such as complaints. ‘Less’ fits amounts that are not counted one by one.",
    optionWhy: [
      "Correct. Complaints can be counted, so ‘fewer’ is the word.",
      "‘Less’ does not fit a countable plural like complaints.",
      "‘Fewer’ needs a plural noun. ‘Complaint’ is singular here.",
      "‘Lesser’ means smaller in importance or degree, not a smaller number of items.",
    ],
  }),
  question({
    id: "q-c-imply",
    passageId: "p-c-imply",
    skill: "spelling-confused-words",
    category: "conventions",
    difficulty: "challenging",
    tags: ["imply", "infer"],
    pitfall: { id: "imply-infer", label: "Swapping imply and infer" },
    stem: "Which sentence gives each action to the right person?",
    options: [
      "The notice implies a stricter rule, and the reader infers it from the last sentence.",
      "The notice infers a stricter rule, and the reader implies it from the last sentence.",
      "The notice implies a stricter rule, and the reader implies it from the last sentence.",
      "The reader implies a stricter rule into the notice, which then infers the reader.",
    ],
    correctIndex: 0,
    explanation: "A writer or text implies a meaning. A reader infers that meaning.",
    optionWhy: [
      "Correct. The notice hints, and the reader draws the meaning out.",
      "The verbs are swapped. A notice does not infer, and a reader does not imply the hint that is already in the text.",
      "The notice can imply, but the reader’s action is to infer, not to imply as well.",
      "This reverses the direction. Readers do not imply a rule into a notice in this technical pair.",
    ],
  }),
  question({
    id: "q-c-whose",
    passageId: "p-c-whose",
    skill: "spelling-confused-words",
    category: "conventions",
    difficulty: "easy",
    tags: ["whose", "who's"],
    pitfall: { id: "whose-whos", label: "Confusing whose and who’s" },
    stem: "Which question asks about ownership of the draft?",
    options: [
      "Whose draft is this?",
      "Who’s draft is this?",
      "Who’s draft is this belonging?",
      "Whose is this, meaning who is this?",
    ],
    correctIndex: 0,
    explanation: "‘Whose’ asks about possession. ‘Who’s’ means ‘who is’ or ‘who has’.",
    optionWhy: [
      "Correct. ‘Whose’ is the possessive question word.",
      "‘Who’s draft’ means ‘who is draft’, which does not ask about ownership.",
      "Adding ‘belonging’ does not repair ‘who’s’, which still means ‘who is’.",
      "The gloss ‘who is this’ belongs to ‘who’s’, not to ‘whose’. The option describes the wrong meaning.",
    ],
  }),
];
