// Mock data so the app is fully browsable before Firebase is connected.
// Every list here maps 1:1 to a Firestore collection described in README.md.

export const ME = {
  id: 'u0',
  name: 'You',
  dept: 'CSE',
  year: '3rd year',
  bio: 'Coffee, code and campus sunsets.',
  avatarColor: '#0F5C4A',
  interests: ['Photography', 'Cricket', 'Startups'],
};

export const USERS = [
  { id: 'u1', name: 'Nusrat J.', dept: 'EEE', year: '2nd year', distanceKm: 0.2, interests: ['Debate', 'Sketching'], avatarColor: '#B4654A', lookingFor: 'Friends' },
  { id: 'u2', name: 'Rafi A.', dept: 'BBA', year: '4th year', distanceKm: 0.4, interests: ['Football', 'Music'], avatarColor: '#4A6FB4', lookingFor: 'Dating' },
  { id: 'u3', name: 'Tanisha R.', dept: 'CSE', year: '3rd year', distanceKm: 0.6, interests: ['AI Club', 'Chess'], avatarColor: '#8A4AB4', lookingFor: 'Study partner' },
  { id: 'u4', name: 'Sabbir H.', dept: 'Civil', year: '1st year', distanceKm: 1.1, interests: ['Photography'], avatarColor: '#4AB48E', lookingFor: 'Friends' },
  { id: 'u5', name: 'Maliha K.', dept: 'Pharmacy', year: '2nd year', distanceKm: 1.4, interests: ['Volunteering', 'Baking'], avatarColor: '#B44A6F', lookingFor: 'Dating' },
];

export const POSTS = [
  {
    id: 'p1',
    author: USERS[0],
    anonymous: false,
    time: '12 min ago',
    text: 'Golden hour at the central library never misses. Who else is here studying for finals?',
    mediaType: 'photo',
    likes: 42,
    comments: 8,
  },
  {
    id: 'p2',
    author: null,
    anonymous: true,
    time: '1 h ago',
    text: 'Confession: I have had a crush on someone from my Algorithms section for two semesters and still have not said a word.',
    mediaType: null,
    likes: 128,
    comments: 31,
  },
  {
    id: 'p3',
    author: USERS[1],
    anonymous: false,
    time: '3 h ago',
    text: 'Highlights from yesterday inter-department football final. What a match!',
    mediaType: 'video',
    likes: 96,
    comments: 14,
  },
  {
    id: 'p4',
    author: USERS[2],
    anonymous: false,
    time: '5 h ago',
    text: 'Sharing my complete note set for Data Structures (mid + final). Link in comments. Good luck everyone!',
    mediaType: null,
    likes: 210,
    comments: 47,
  },
];

export const CHATS = [
  { id: 'c1', user: USERS[0], last: 'See you at the library then!', time: '2m', unread: 2, anonymous: false },
  { id: 'c2', user: { id: 'anon1', name: 'Anonymous Fox', avatarColor: '#4B3F72' }, last: 'I liked your post about the fest...', time: '25m', unread: 1, anonymous: true },
  { id: 'c3', user: USERS[2], last: 'Did you finish the assignment?', time: '1h', unread: 0, anonymous: false },
  { id: 'c4', user: USERS[4], last: 'That cafe near gate 2 is great', time: 'Tue', unread: 0, anonymous: false },
];

export const MESSAGES = [
  { id: 'm1', mine: false, text: 'Hey! Are you going to the CSE fest this weekend?', time: '10:02' },
  { id: 'm2', mine: true, text: 'Definitely. I heard the project showcase is huge this year.', time: '10:04' },
  { id: 'm3', mine: false, text: 'We should team up for the hackathon segment.', time: '10:05' },
  { id: 'm4', mine: true, text: 'I am in. Voice call later to plan?', time: '10:07' },
];

export const SPOTLIGHT = {
  weekLabel: 'Week of 29 Jun – 5 Jul',
  categories: [
    {
      id: 'sp1',
      title: 'Campus Star',
      subtitle: 'Most-voted opted-in profile this week',
      entries: [
        { id: 'e1', user: USERS[0], votes: 342, tagline: 'Debate champ, part-time poet' },
        { id: 'e2', user: USERS[1], votes: 311, tagline: 'Football final hero' },
        { id: 'e3', user: USERS[4], votes: 264, tagline: 'Bakes for the whole dorm' },
      ],
    },
    {
      id: 'sp2',
      title: 'Helper of the Week',
      subtitle: 'Voted by students they helped',
      entries: [
        { id: 'e4', user: USERS[2], votes: 405, tagline: 'Shared full DS note set' },
        { id: 'e5', user: USERS[3], votes: 199, tagline: 'Free photography for club events' },
      ],
    },
  ],
};

export const COURSES = [
  { id: 'ed1', title: 'Data Structures crash notes', author: 'Tanisha R.', kind: 'Notes', dept: 'CSE', saves: 210 },
  { id: 'ed2', title: 'IELTS prep study circle — join us', author: 'English Club', kind: 'Study group', dept: 'All', saves: 88 },
  { id: 'ed3', title: 'Thermodynamics solved past papers', author: 'Sabbir H.', kind: 'Past papers', dept: 'ME', saves: 143 },
  { id: 'ed4', title: 'Intro to Machine Learning — free weekend workshop', author: 'AI Club', kind: 'Workshop', dept: 'All', saves: 301 },
];

export const JOBS = [
  { id: 'j1', role: 'Frontend Intern (React)', org: 'Local startup — Banani', type: 'Internship', pay: '৳8,000/mo', posted: '2d ago' },
  { id: 'j2', role: 'Campus Ambassador', org: 'EdTech BD', type: 'Part-time', pay: 'Commission', posted: '3d ago' },
  { id: 'j3', role: 'Junior Graphic Designer', org: 'Agency — remote', type: 'Part-time', pay: '৳12,000/mo', posted: '5d ago' },
  { id: 'j4', role: 'Research Assistant (NLP lab)', org: 'University CSE Dept', type: 'On-campus', pay: 'Stipend', posted: '1w ago' },
];
