const relationships = [
  {
    id: 'rel-0',
    text: 'What is often called the most important ingredient for a healthy relationship?',
    options: ['Shared finances', 'Communication', 'Same hobbies', 'Living together'],
    correctAnswer: 1,
  },
  {
    id: 'rel-1',
    text: 'Which attachment style is characterized by a fear of intimacy and independence?',
    options: ['Secure', 'Anxious', 'Avoidant', 'Disorganized'],
    correctAnswer: 2,
  },
  {
    id: 'rel-2',
    text: 'The "five love languages" concept was introduced by which author?',
    options: ['John Gottman', 'Gary Chapman', 'Esther Perel', 'Harville Hendrix'],
    correctAnswer: 1,
  },
  {
    id: 'rel-3',
    text: 'What does a healthy "boundary" in a relationship primarily do?',
    options: ['Creates distance', 'Protects individual well-being', 'Limits freedom', 'Controls the partner'],
    correctAnswer: 1,
  },
  {
    id: 'rel-4',
    text: 'Which psychologist is known for his research on relationship stability and the "magic ratio" of 5:1?',
    options: ['Sigmund Freud', 'Carl Jung', 'John Gottman', 'B.F. Skinner'],
    correctAnswer: 2,
  },
  {
    id: 'rel-5',
    text: 'What is "stonewalling" in the context of relationship conflict?',
    options: ['Physical aggression', 'Refusing to engage or communicate', 'Name-calling', 'Blaming the partner'],
    correctAnswer: 1,
  },
  {
    id: 'rel-6',
    text: 'Which of the following is a sign of a codependent relationship?',
    options: ['Healthy individual hobbies', 'One person sacrificing their needs for the other', 'Open communication', 'Respecting boundaries'],
    correctAnswer: 1,
  },
  {
    id: 'rel-7',
    text: 'What does the "honeymoon phase" typically refer to?',
    options: ['A vacation period', 'The early stage of a relationship with intense passion', 'A counseling technique', 'A financial agreement'],
    correctAnswer: 1,
  },
  {
    id: 'rel-8',
    text: 'Which of these is NOT one of the Five Love Languages?',
    options: ['Words of affirmation', 'Quality time', 'Financial support', 'Physical touch'],
    correctAnswer: 2,
  },
  {
    id: 'rel-9',
    text: 'According to research, how long does the average couple wait before seeking relationship counseling?',
    options: ['1 month', '6 months', '6 years', '10 years'],
    correctAnswer: 2,
  },
];

const frontend = [
  {
    id: 'fe-0',
    text: 'Which CSS property is used to create a flex container?',
    options: ['display: block', 'display: inline', 'display: flex', 'position: relative'],
    correctAnswer: 2,
  },
  {
    id: 'fe-1',
    text: 'What does the acronym "DOM" stand for?',
    options: ['Data Object Model', 'Document Object Model', 'Digital Output Module', 'Document Oriented Markup'],
    correctAnswer: 1,
  },
  {
    id: 'fe-2',
    text: 'Which hook in React is used to perform side effects in function components?',
    options: ['useState', 'useEffect', 'useMemo', 'useContext'],
    correctAnswer: 1,
  },
  {
    id: 'fe-3',
    text: 'What is the default value of the CSS "position" property?',
    options: ['relative', 'absolute', 'fixed', 'static'],
    correctAnswer: 3,
  },
  {
    id: 'fe-4',
    text: 'Which JavaScript method converts a JSON string into an object?',
    options: ['JSON.stringify()', 'JSON.parse()', 'JSON.object()', 'JSON.convert()'],
    correctAnswer: 1,
  },
  {
    id: 'fe-5',
    text: 'What is the main purpose of the "key" prop in React lists?',
    options: ['Styling list items', 'Improving accessibility', 'Helping React identify which items changed', 'Enabling animations'],
    correctAnswer: 2,
  },
  {
    id: 'fe-6',
    text: 'Which semantic HTML element represents the main content of a document?',
    options: ['<section>', '<div>', '<article>', '<main>'],
    correctAnswer: 3,
  },
  {
    id: 'fe-7',
    text: 'In Tailwind CSS, which class applies "padding: 1rem" on all sides?',
    options: ['p-4', 'px-4', 'py-4', 'pad-4'],
    correctAnswer: 0,
  },
  {
    id: 'fe-8',
    text: 'Which of the following is NOT a JavaScript primitive type?',
    options: ['string', 'boolean', 'object', 'symbol'],
    correctAnswer: 2,
  },
  {
    id: 'fe-9',
    text: 'What does the "aria-label" attribute do?',
    options: ['Styles an element', 'Provides an accessible name for assistive technology', 'Adds a tooltip', 'Links an element to a label'],
    correctAnswer: 1,
  },
];

const backend = [
  {
    id: 'be-0',
    text: 'Which HTTP method is used to update an existing resource?',
    options: ['GET', 'POST', 'PUT', 'DELETE'],
    correctAnswer: 2,
  },
  {
    id: 'be-1',
    text: 'What does "SQL" stand for?',
    options: ['Structured Query Language', 'Simple Query Logic', 'Sequential Query Language', 'Standard Quality Language'],
    correctAnswer: 0,
  },
  {
    id: 'be-2',
    text: 'Which status code means "Not Found"?',
    options: ['200', '301', '404', '500'],
    correctAnswer: 2,
  },
  {
    id: 'be-3',
    text: 'What is a primary key in a relational database?',
    options: ['The first column of a table', 'A unique identifier for each row', 'An index on a foreign table', 'A type of join'],
    correctAnswer: 1,
  },
  {
    id: 'be-4',
    text: 'Which of the following is a NoSQL database?',
    options: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'],
    correctAnswer: 2,
  },
  {
    id: 'be-5',
    text: 'What does "JWT" stand for?',
    options: ['JavaScript Web Token', 'JSON Web Token', 'Java Web Template', 'JSON Web Transport'],
    correctAnswer: 1,
  },
  {
    id: 'be-6',
    text: 'Which caching strategy stores data in memory for fast retrieval?',
    options: ['Redis', 'Docker', 'Kubernetes', 'Nginx'],
    correctAnswer: 0,
  },
  {
    id: 'be-7',
    text: 'What is the main purpose of an API gateway?',
    options: ['Styling frontends', 'Routing requests to backend services', 'Compiling code', 'Encrypting passwords'],
    correctAnswer: 1,
  },
  {
    id: 'be-8',
    text: 'Which protocol is used to securely transfer data over the web?',
    options: ['FTP', 'HTTP', 'HTTPS', 'SMTP'],
    correctAnswer: 2,
  },
  {
    id: 'be-9',
    text: 'What is "idempotency" in the context of HTTP requests?',
    options: ['Making a request faster', 'A request producing the same result when repeated', 'Encrypting request bodies', 'Compressing responses'],
    correctAnswer: 1,
  },
];

const currentAffairs = [
  {
    id: 'ca-0',
    text: 'What does "ESG" stand for in corporate investing?',
    options: ['Economic, Social, Governance', 'Environmental, Social, Governance', 'Equity, Strategy, Growth', 'Energy, Sustainability, Green'],
    correctAnswer: 1,
  },
  {
    id: 'ca-1',
    text: 'Which organization sets global interest rates for its member central banks?',
    options: ['World Bank', 'IMF', 'Federal Reserve', 'European Central Bank'],
    correctAnswer: 1,
  },
  {
    id: 'ca-2',
    text: 'What does "AI" in the context of ChatGPT stand for?',
    options: ['Advanced Interface', 'Artificial Intelligence', 'Automated Input', 'Analytical Index'],
    correctAnswer: 1,
  },
  {
    id: 'ca-3',
    text: 'Which term describes the gradual increase in Earth\u2019s average temperature?',
    options: ['Global warming', 'Ozone depletion', 'Acid rain', 'El Ni\u00f1o'],
    correctAnswer: 0,
  },
  {
    id: 'ca-4',
    text: 'What is the primary currency of the European Union?',
    options: ['Pound', 'Dollar', 'Euro', 'Franc'],
    correctAnswer: 2,
  },
  {
    id: 'ca-5',
    text: 'Which international agreement aims to limit global temperature rise?',
    options: ['Kyoto Protocol', 'Paris Agreement', 'Geneva Convention', 'Montreal Protocol'],
    correctAnswer: 1,
  },
  {
    id: 'ca-6',
    text: 'What does "GDP" measure?',
    options: ['Gross Domestic Product', 'Global Development Plan', 'General Data Policy', 'Gross Digital Progress'],
    correctAnswer: 0,
  },
  {
    id: 'ca-7',
    text: 'Which body is the principal judicial organ of the United Nations?',
    options: ['UNESCO', 'WHO', 'International Court of Justice', 'UNICEF'],
    correctAnswer: 2,
  },
  {
    id: 'ca-8',
    text: 'What does the term "inflation" refer to?',
    options: ['A rise in the general price level', 'A decrease in exports', 'An increase in population', 'A fall in interest rates'],
    correctAnswer: 0,
  },
  {
    id: 'ca-9',
    text: 'Which technology underpins cryptocurrencies like Bitcoin?',
    options: ['Machine learning', 'Cloud computing', 'Blockchain', 'Quantum computing'],
    correctAnswer: 2,
  },
];

export const questionBank = {
  relationships,
  frontend,
  backend,
  currentAffairs,
};