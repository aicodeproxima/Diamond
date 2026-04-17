/**
 * Bible Study Curriculum — 5 Steps × 10 Subjects = 50 total.
 * Used by the mock scenario to assign current-study subjects to contacts.
 */

export interface StudySubject {
  step: number;
  index: number;
  title: string;
}

export const STUDY_SUBJECTS: StudySubject[] = [
  // Step 1
  { step: 1, index: 1, title: 'The Secret of the Forgiveness of Sins and Christ Ahnsahnghong' },
  { step: 1, index: 2, title: 'The Savior of Each Age and the New Name' },
  { step: 1, index: 3, title: 'The Tree of Life and Christ Ahnsahnghong' },
  { step: 1, index: 4, title: 'Jerusalem Mother' },
  { step: 1, index: 5, title: 'Heavenly Family and Earthly Family' },
  { step: 1, index: 6, title: 'Keep the Sabbath Day Holy' },
  { step: 1, index: 7, title: 'Passover, the Way to Eternal Life' },
  { step: 1, index: 8, title: 'Cross-Reverence Is Idolatry' },
  { step: 1, index: 9, title: 'Be Baptized Immediately' },
  { step: 1, index: 10, title: 'The Bible Is Fact' },

  // Step 2
  { step: 2, index: 1, title: 'Whom Does the Bible Testify About?' },
  { step: 2, index: 2, title: 'King David and Christ Ahnsahnghong' },
  { step: 2, index: 3, title: 'God Who Built Zion' },
  { step: 2, index: 4, title: 'Heavenly Wedding Banquet' },
  { step: 2, index: 5, title: 'The History of Abraham\u2019s Family' },
  { step: 2, index: 6, title: 'The Prophecy of Daniel 2, 7' },
  { step: 2, index: 7, title: 'The Prophecy of Revelation 13' },
  { step: 2, index: 8, title: 'The Prophecy of Revelation 17, 18' },
  { step: 2, index: 9, title: 'The Law of Tithe' },
  { step: 2, index: 10, title: 'The City of Refuge and the Earth' },

  // Step 3
  { step: 3, index: 1, title: 'The Trinity' },
  { step: 3, index: 2, title: 'The Order of Melchizedek' },
  { step: 3, index: 3, title: 'Mother, the Source of the Water of Life' },
  { step: 3, index: 4, title: 'Weeds and Wheat' },
  { step: 3, index: 5, title: 'The Church Bought With God\u2019s Own Blood' },
  { step: 3, index: 6, title: 'What Is the Gospel?' },
  { step: 3, index: 7, title: 'You Shall Have No Other Gods Before Me' },
  { step: 3, index: 8, title: 'The Work of God\u2019s Putting a Seal' },
  { step: 3, index: 9, title: 'The Book of Life' },
  { step: 3, index: 10, title: 'The Soul Exists' },

  // Step 4
  { step: 4, index: 1, title: 'The Church Established by the Root of David' },
  { step: 4, index: 2, title: 'The Last Adam and Christ Ahnsahnghong' },
  { step: 4, index: 3, title: 'The Bible Is a Book of Prophecy' },
  { step: 4, index: 4, title: 'What Day of the Week Is the Biblical Sabbath?' },
  { step: 4, index: 5, title: 'The True Meaning of the Passover' },
  { step: 4, index: 6, title: 'The Law of Moses and the Law of Christ' },
  { step: 4, index: 7, title: 'Moses and Jesus (Meaning of the Cross)' },
  { step: 4, index: 8, title: 'Who Are False Prophets?' },
  { step: 4, index: 9, title: 'Blessings Through Tithing' },
  { step: 4, index: 10, title: 'About Food' },

  // Step 5
  { step: 5, index: 1, title: 'The Words of God Are Absolute' },
  { step: 5, index: 2, title: 'Apart From Me, You Can Do Nothing' },
  { step: 5, index: 3, title: 'The Commands of God and the Rules of Men' },
  { step: 5, index: 4, title: 'Watch Out for False Prophets' },
  { step: 5, index: 5, title: 'The Reign of God and the Reign of the Devil' },
  { step: 5, index: 6, title: 'The Law of Life and the Law of Death' },
  { step: 5, index: 7, title: 'Jesus\u2019 Second Coming and the Last Judgment' },
  { step: 5, index: 8, title: 'Coming on the Clouds' },
  { step: 5, index: 9, title: 'The Lesson From the Fig Tree' },
  { step: 5, index: 10, title: 'God\u2019s Coming From the East' },

  // TRE — standalone individual study, not a group of subjects like Steps 1-5.
  // A single entry so the TRE tab shows one toggleable item.
  { step: 6, index: 1, title: 'TRE (Timeline)' },
];
