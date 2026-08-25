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

const cybersecurity = [
  {
    id: 'cy-0',
    text: 'What does "phishing" refer to in cybersecurity?',
    options: ['A type of malware', 'A social engineering attack to steal credentials', 'A network scanning tool', 'An encryption method'],
    correctAnswer: 1,
  },
  {
    id: 'cy-1',
    text: 'Which protocol encrypts data transmitted over the web?',
    options: ['FTP', 'HTTP', 'HTTPS', 'SMTP'],
    correctAnswer: 2,
  },
  {
    id: 'cy-2',
    text: 'What is a "firewall" primarily used for?',
    options: ['Storing passwords', 'Monitoring and controlling network traffic', 'Compressing files', 'Running virtual machines'],
    correctAnswer: 1,
  },
  {
    id: 'cy-3',
    text: 'What does "VPN" stand for?',
    options: ['Virtual Private Network', 'Very Protected Node', 'Verified Public Network', 'Virtual Proxy Network'],
    correctAnswer: 0,
  },
  {
    id: 'cy-4',
    text: 'Which of these is a strong password practice?',
    options: ['Using your birthdate', 'Using the same password everywhere', 'Using a passphrase with mixed characters', 'Using short dictionary words'],
    correctAnswer: 2,
  },
  {
    id: 'cy-5',
    text: 'What is "ransomware"?',
    options: ['Software that speeds up your computer', 'Malware that encrypts files and demands payment', 'A type of antivirus', 'A backup utility'],
    correctAnswer: 1,
  },
  {
    id: 'cy-6',
    text: 'What does "SQL injection" target?',
    options: ['Network routers', 'Database queries through input fields', 'Email servers', 'Firewall rules'],
    correctAnswer: 1,
  },
  {
    id: 'cy-7',
    text: 'Which authentication method uses a code sent to your phone?',
    options: ['Password only', 'Biometrics', 'Two-factor authentication (2FA)', 'Security question'],
    correctAnswer: 2,
  },
  {
    id: 'cy-8',
    text: 'What is a "zero-day exploit"?',
    options: ['An attack on a server with zero uptime', 'An attack using a vulnerability not yet patched', 'A virus that deletes all files', 'An attack with zero damage'],
    correctAnswer: 1,
  },
  {
    id: 'cy-9',
    text: 'What is the principle of "least privilege"?',
    options: ['Give users maximum access for efficiency', 'Give users only the access they need to perform their job', 'Remove all user accounts', 'Allow anonymous access'],
    correctAnswer: 1,
  },
];

const digitalMarketing = [
  {
    id: 'dm-0',
    text: 'What does "SEO" stand for?',
    options: ['Social Engine Optimization', 'Search Engine Optimization', 'Site Engagement Optimization', 'Search Email Outreach'],
    correctAnswer: 1,
  },
  {
    id: 'dm-1',
    text: 'Which metric measures the percentage of visitors who leave after viewing one page?',
    options: ['Conversion rate', 'Bounce rate', 'Click-through rate', 'Retention rate'],
    correctAnswer: 1,
  },
  {
    id: 'dm-2',
    text: 'What is "PPC" in digital advertising?',
    options: ['Pay Per Click', 'Posted Product Content', 'Public Page Campaign', 'Post Production Content'],
    correctAnswer: 0,
  },
  {
    id: 'dm-3',
    text: 'Which platform is primarily used for professional B2B marketing?',
    options: ['TikTok', 'LinkedIn', 'Snapchat', 'Pinterest'],
    correctAnswer: 1,
  },
  {
    id: 'dm-4',
    text: 'What is a "CTA" on a landing page?',
    options: ['Content Targeting Algorithm', 'Call To Action', 'Customer Tracking Agent', 'Campaign Total Analysis'],
    correctAnswer: 1,
  },
  {
    id: 'dm-5',
    text: 'What does "ROI" measure in marketing?',
    options: ['Revenue In Output', 'Return On Investment', 'Rate Of Interaction', 'Reach Of Influence'],
    correctAnswer: 1,
  },
  {
    id: 'dm-6',
    text: 'What is "content marketing"?',
    options: ['Buying ad space', 'Creating valuable content to attract and engage an audience', 'Sending spam emails', 'Hiring influencers exclusively'],
    correctAnswer: 1,
  },
  {
    id: 'dm-7',
    text: 'What is an "email open rate"?',
    options: ['How fast emails load', 'The percentage of recipients who opened the email', 'The number of emails sent', 'The email bounce percentage'],
    correctAnswer: 1,
  },
  {
    id: 'dm-8',
    text: 'What does "A/B testing" involve?',
    options: ['Testing two versions to see which performs better', 'Testing with group A only', 'Checking server A and B', 'Running two campaigns simultaneously with different budgets'],
    correctAnswer: 0,
  },
  {
    id: 'dm-9',
    text: 'What is "retargeting" in digital marketing?',
    options: ['Targeting new customers only', 'Showing ads to users who previously interacted with your brand', 'Setting new marketing targets', 'Changing your target audience'],
    correctAnswer: 1,
  },
];

const productDesign = [
  {
    id: 'pd-0',
    text: 'What is a "wireframe" in product design?',
    options: ['A final high-fidelity mockup', 'A low-fidelity visual layout showing structure', 'A 3D model of the product', 'A color palette guide'],
    correctAnswer: 1,
  },
  {
    id: 'pd-1',
    text: 'What does "UX" stand for?',
    options: ['Universal Experience', 'User Experience', 'User Execution', 'Unified Extension'],
    correctAnswer: 1,
  },
  {
    id: 'pd-2',
    text: 'What is the purpose of a "user persona"?',
    options: ['To define the product price', 'To represent a target user archetype based on research', 'To outline the tech stack', 'To list competitor features'],
    correctAnswer: 1,
  },
  {
    id: 'pd-3',
    text: 'What is "responsive design"?',
    options: ['Design that only works on desktop', 'Design that adapts to different screen sizes and devices', 'Design with fast load times', 'Design with animations'],
    correctAnswer: 1,
  },
  {
    id: 'pd-4',
    text: 'What does "UI" stand for?',
    options: ['Unified Interface', 'User Interface', 'Universal Integration', 'User Interaction'],
    correctAnswer: 1,
  },
  {
    id: 'pd-5',
    text: 'What is a "design system"?',
    options: ['A single font choice', 'A collection of reusable components, guidelines, and standards', 'A prototyping tool only', 'A coding framework'],
    correctAnswer: 1,
  },
  {
    id: 'pd-6',
    text: 'What is "usability testing"?',
    options: ['Testing server speed', 'Evaluating a product by having real users perform tasks', 'Checking code quality', 'A/B testing colors'],
    correctAnswer: 1,
  },
  {
    id: 'pd-7',
    text: 'What is the "F-pattern" in UX?',
    options: ['A layout matching how users scan web content', 'A fishbone diagram for debugging', 'A type of navigation menu', 'A color gradient style'],
    correctAnswer: 0,
  },
  {
    id: 'pd-8',
    text: 'What is "information architecture"?',
    options: ['Server infrastructure design', 'Organizing and structuring content for usability', 'Database schema design', 'Network topology planning'],
    correctAnswer: 1,
  },
  {
    id: 'pd-9',
    text: 'What is a "prototype" used for?',
    options: ['Final production deployment', 'Simulating the product to test interactions before development', 'Marketing the product', 'Storing design files'],
    correctAnswer: 1,
  },
];

const dataAnalytics = [
  {
    id: 'da-0',
    text: 'What does "ETL" stand for in data pipelines?',
    options: ['Extract, Transform, Load', 'Evaluate, Test, Launch', 'Encode, Transfer, Log', 'Extract, Translate, List'],
    correctAnswer: 0,
  },
  {
    id: 'da-1',
    text: 'What is a "data warehouse"?',
    options: ['A physical storage facility', 'A system for reporting and data analysis, storing structured data', 'A backup hard drive', 'A real-time messaging queue'],
    correctAnswer: 1,
  },
  {
    id: 'da-2',
    text: 'What is "data visualization"?',
    options: ['Encrypting data', 'Representing data graphically to identify patterns', 'Deleting unused data', 'Compressing data files'],
    correctAnswer: 1,
  },
  {
    id: 'da-3',
    text: 'What does "KPI" stand for?',
    options: ['Key Performance Indicator', 'Known Problem Index', 'Kernel Processing Input', 'Key Program Interface'],
    correctAnswer: 0,
  },
  {
    id: 'da-4',
    text: 'What is "regression analysis" used for?',
    options: ['Deleting old data', 'Estimating relationships between variables', 'Encrypting datasets', 'Creating backups'],
    correctAnswer: 1,
  },
  {
    id: 'da-5',
    text: 'What is the difference between "mean" and "median"?',
    options: ['They are the same thing', 'Mean is the average, median is the middle value', 'Mean is for text, median is for numbers', 'Median is always higher'],
    correctAnswer: 1,
  },
  {
    id: 'da-6',
    text: 'What is "data cleansing"?',
    options: ['Encrypting sensitive data', 'Detecting and correcting corrupt or inaccurate records', 'Deleting old databases', 'Creating data backups'],
    correctAnswer: 1,
  },
  {
    id: 'da-7',
    text: 'What is a "dashboard" in analytics?',
    options: ['A login page', 'A visual display of key metrics and data in real time', 'A server monitoring tool', 'A file management system'],
    correctAnswer: 1,
  },
  {
    id: 'da-8',
    text: 'What does "SQL" allow you to do with databases?',
    options: ['Design graphics', 'Query and manipulate structured data', 'Create websites', 'Send emails'],
    correctAnswer: 1,
  },
  {
    id: 'da-9',
    text: 'What is "cohort analysis"?',
    options: ['Analyzing server logs', 'Grouping users by shared characteristics and tracking behavior over time', 'Running A/B tests', 'Measuring website speed'],
    correctAnswer: 1,
  },
];

const mobileAppDev = [
  {
    id: 'ma-0',
    text: 'What is "React Native"?',
    options: ['A native iOS framework', 'A framework for building cross-platform mobile apps with React', 'A database tool', 'A CSS preprocessor'],
    correctAnswer: 1,
  },
  {
    id: 'ma-1',
    text: 'What does "SDK" stand for?',
    options: ['Software Development Kit', 'System Design Knowledge', 'Server Data Kernel', 'Standard Development Key'],
    correctAnswer: 0,
  },
  {
    id: 'ma-2',
    text: 'Which language is primarily used for iOS app development?',
    options: ['Java', 'Swift', 'Python', 'PHP'],
    correctAnswer: 1,
  },
  {
    id: 'ma-3',
    text: 'What is "Flutter"?',
    options: ['A database management tool', 'A UI toolkit for building natively compiled apps from a single codebase', 'A testing framework', 'A cloud hosting service'],
    correctAnswer: 1,
  },
  {
    id: 'ma-4',
    text: 'What is "Kotlin" used for?',
    options: ['Web styling only', 'Android app development (and other platforms)', 'Database queries', 'Operating system design'],
    correctAnswer: 1,
  },
  {
    id: 'ma-5',
    text: 'What is a "REST API" in mobile development?',
    options: ['A休息 mode for devices', 'An interface for communication between app and server using HTTP', 'A type of animation', 'A local storage method'],
    correctAnswer: 1,
  },
  {
    id: 'ma-6',
    text: 'What is "push notification"?',
    options: ['An email alert', 'A message sent to a user device even when the app is not open', 'A text message', 'An in-app popup'],
    correctAnswer: 1,
  },
  {
    id: 'ma-7',
    text: 'What is the "App Store" for iOS apps?',
    options: ['A code editor', 'Apple\'s marketplace for distributing iOS applications', 'A cloud server', 'A design tool'],
    correctAnswer: 1,
  },
  {
    id: 'ma-8',
    text: 'What is "responsive" in mobile design?',
    options: ['Fast app loading', 'UI adapting gracefully to different screen sizes', 'App that responds to voice commands', 'An app with many features'],
    correctAnswer: 1,
  },
  {
    id: 'ma-9',
    text: 'What is "Firebase" commonly used for in mobile apps?',
    options: ['Graphic design only', 'Backend services like auth, database, and notifications', 'Code compilation', 'Device hardware control'],
    correctAnswer: 1,
  },
];

export const questionBank = {
  relationships,
  frontend,
  backend,
  currentAffairs,
  cybersecurity,
  digitalMarketing,
  productDesign,
  dataAnalytics,
  mobileAppDev,
};

/**
 * Tags each question with a difficulty level (1-5) based on its position
 * in the bank, then returns questions appropriate for the given level.
 * Questions near the start are easier; later ones are harder.
 * Returns a mix: questions from the current level ± 1.
 */
export function getQuestionsForLevel(questions, level) {
  const tagged = questions.map((q, i) => {
    const ratio = i / Math.max(questions.length - 1, 1);
    let difficulty;
    if (ratio < 0.2) difficulty = 1;
    else if (ratio < 0.4) difficulty = 2;
    else if (ratio < 0.6) difficulty = 3;
    else if (ratio < 0.8) difficulty = 4;
    else difficulty = 5;
    return { ...q, difficulty };
  });

  const minDiff = Math.max(1, level - 1);
  const maxDiff = Math.min(5, level + 1);
  return tagged.filter((q) => q.difficulty >= minDiff && q.difficulty <= maxDiff);
}