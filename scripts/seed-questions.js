/**
 * Firestore seed script for custom category questions.
 * Run: node scripts/seed-questions.js
 *
 * Seeds the 'questions' collection with questions for categories
 * that don't have reliable external API coverage.
 */
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const QUESTIONS = {
  'current-affairs': [
    {
      text: 'What year did the United Nations adopt the Sustainable Development Goals?',
      options: ['2015', '2010', '2020', '2018'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'The SDGs were adopted in September 2015 as part of the 2030 Agenda.',
    },
    {
      text: 'Which country recently became the world\'s most populous nation?',
      options: ['India', 'China', 'Indonesia', 'Brazil'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'India surpassed China in population in 2023.',
    },
    {
      text: 'What is the name of the global climate agreement adopted in 2015?',
      options: ['Paris Agreement', 'Kyoto Protocol', 'Montreal Protocol', 'Geneva Accord'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'The Paris Agreement was adopted at COP21 in December 2015.',
    },
    {
      text: 'Which organization coordinates global pandemic response?',
      options: ['WHO', 'UNICEF', 'WTO', 'IMF'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'The World Health Organization (WHO) leads international public health efforts.',
    },
    {
      text: 'What does GDP stand for in economics?',
      options: ['Gross Domestic Product', 'General Development Plan', 'Global Distribution Protocol', 'Gross Direct Profit'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'GDP measures the total monetary value of goods and services produced within a country.',
    },
    {
      text: 'Which global event caused major supply chain disruptions starting in 2020?',
      options: ['COVID-19 pandemic', 'Trade war', 'Oil crisis', 'Financial crash'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'The COVID-19 pandemic disrupted global supply chains from 2020 onwards.',
    },
    {
      text: 'What is the primary goal of the COP climate summits?',
      options: ['Reduce greenhouse gas emissions', 'Increase fossil fuel production', 'Promote deforestation', 'Lower ocean temperatures'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'COP summits aim to negotiate and implement climate action plans.',
    },
    {
      text: 'Which international treaty aims to protect the ozone layer?',
      options: ['Montreal Protocol', 'Paris Agreement', 'Kyoto Protocol', 'Geneva Convention'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'The Montreal Protocol (1987) phased out ozone-depleting substances.',
    },
    {
      text: 'What does the term "inflation" refer to?',
      options: ['Rising prices over time', 'Falling stock prices', 'Increasing unemployment', 'Growing GDP'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'Inflation is the rate at which the general level of prices for goods and services rises.',
    },
    {
      text: 'Which organization manages the world\'s largest financial reserve?',
      options: ['US Federal Reserve', 'European Central Bank', 'Bank of Japan', 'People\'s Bank of China'],
      correctAnswer: 0,
      difficulty: 'hard',
      explanation: 'The US Federal Reserve oversees the world\'s primary reserve currency (USD).',
    },
  ],
  relationships: [
    {
      text: 'What is the "5:1 ratio" in relationship psychology?',
      options: ['5 positive interactions for every 1 negative', '5 dates before commitment', '5 years before marriage', '5 qualities in a partner'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'John Gottman found stable couples have 5 positive interactions for every 1 negative.',
    },
    {
      text: 'Which attachment style is characterized by fear of abandonment?',
      options: ['Anxious', 'Avoidant', 'Secure', 'Disorganized'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'Anxious attachment involves worry about rejection and need for reassurance.',
    },
    {
      text: 'What is "love bombing" in relationships?',
      options: ['Excessive affection to manipulate', 'Sending love letters', 'Playing romantic music', 'Buying expensive gifts'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'Love bombing is overwhelming someone with attention to gain control.',
    },
    {
      text: 'According to research, what predicts relationship success best?',
      options: ['How couples handle conflict', 'Shared hobbies', 'Physical attraction', 'Financial stability'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'Gottman research shows conflict management is the strongest predictor.',
    },
    {
      text: 'What is the "honeymoon phase" typically lasting?',
      options: ['6 months to 2 years', '1 month', '5 years', '10 years'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'The initial intense romantic phase usually lasts 6 months to 2 years.',
    },
    {
      text: 'Which communication pattern is most harmful to relationships?',
      options: ['Stonewalling', 'Active listening', 'Expressing gratitude', 'Sharing feelings'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'Stonewalling (shutting down) is one of the "Four Horsemen" of relationship doom.',
    },
    {
      text: 'What is "emotional intelligence" in relationships?',
      options: ['Understanding and managing emotions', 'Being logical', 'Avoiding arguments', 'Agreeing always'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'EQ involves recognizing, understanding, and managing both your own and others\' emotions.',
    },
    {
      text: 'What does "setting boundaries" mean in relationships?',
      options: ['Defining acceptable behavior', 'Building walls', 'Ignoring the other person', 'Being selfish'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'Boundaries define what you will and won\'t accept in how others treat you.',
    },
    {
      text: 'Which love language involves giving undivided attention?',
      options: ['Quality time', 'Words of affirmation', 'Physical touch', 'Acts of service'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'Quality time means giving someone your full, undivided attention.',
    },
    {
      text: 'What is "gaslighting" in relationships?',
      options: ['Manipulating someone into questioning reality', 'Being romantic', 'Discussing the future', 'Spending time together'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'Gaslighting is a form of psychological manipulation that makes someone doubt their own perception.',
    },
  ],
  'digital-marketing': [
    {
      text: 'What does SEO stand for?',
      options: ['Search Engine Optimization', 'Social Engagement Online', 'Sales and Electronic Outreach', 'Strategic Email Operations'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'SEO is the practice of optimizing content to rank higher in search engine results.',
    },
    {
      text: 'What is the primary goal of content marketing?',
      options: ['Attract and retain customers through valuable content', 'Sell products directly', 'Run TV ads', 'Send spam emails'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'Content marketing focuses on creating valuable content to attract a clearly defined audience.',
    },
    {
      text: 'What is a conversion rate in digital marketing?',
      options: ['Percentage of visitors who take a desired action', 'Number of website visitors', 'Social media followers', 'Email open rate'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'Conversion rate measures how many visitors complete a goal (purchase, sign-up, etc.).',
    },
    {
      text: 'What does CTR measure in online advertising?',
      options: ['Clicks divided by impressions', 'Cost per transaction', 'Customer retention rate', 'Total revenue'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'CTR (Click-Through Rate) = clicks / impressions × 100.',
    },
    {
      text: 'What is A/B testing in marketing?',
      options: ['Comparing two versions to see which performs better', 'Testing on two different days', 'Using two social media platforms', 'Running two campaigns simultaneously'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'A/B testing compares two versions of a page, email, or ad to determine which converts better.',
    },
    {
      text: 'What is the purpose of a landing page?',
      options: ['Convert visitors into leads or customers', 'Display company history', 'Host blog posts', 'Show employee profiles'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'A landing page is designed to capture visitor information or drive a specific action.',
    },
    {
      text: 'What does ROI measure in marketing?',
      options: ['Return on Investment — profit relative to cost', 'Rate of Interest', 'Revenue over Income', 'Online Impact Overview'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'ROI = (Revenue - Cost) / Cost × 100, measuring campaign profitability.',
    },
    {
      text: 'What is a sales funnel?',
      options: ['The journey from awareness to purchase', 'A physical tool for pouring sales', 'A type of advertisement', 'A customer service process'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'A sales funnel maps the stages a customer goes through before making a purchase.',
    },
    {
      text: 'Which metric measures email campaign success?',
      options: ['Open rate', 'Page load time', 'Bounce rate', 'Time on site'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'Open rate measures the percentage of recipients who opened an email.',
    },
    {
      text: 'What is retargeting in digital advertising?',
      options: ['Showing ads to people who previously visited your site', 'Targeting new customers', 'Changing ad colors', 'Reducing ad spend'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'Retargeting shows ads to users who have already interacted with your website or app.',
    },
  ],
  'product-design': [
    {
      text: 'What does UX stand for?',
      options: ['User Experience', 'Universal Exchange', 'User Extension', 'Unified Experience'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'UX (User Experience) encompasses all aspects of how a user interacts with a product.',
    },
    {
      text: 'What is a wireframe in design?',
      options: ['A basic visual guide for layout', 'A type of wire sculpture', 'A network diagram', 'A coding framework'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'A wireframe is a low-fidelity layout showing the structure of a page or screen.',
    },
    {
      text: 'What is the purpose of a design system?',
      options: ['Ensure consistency across products', 'Replace designers with AI', 'Limit creativity', 'Increase development time'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'A design system provides reusable components and guidelines for consistent design.',
    },
    {
      text: 'What does "dark pattern" refer to in UX?',
      options: ['Deceptive design that tricks users', 'Dark-colored themes', 'Night mode features', 'Hidden navigation'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'Dark patterns are UI designs that manipulate users into unintended actions.',
    },
    {
      text: 'What is a prototype?',
      options: ['An early sample or model of a product', 'The final product', 'A type of code', 'A marketing plan'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'A prototype is an experimental model used to test concepts before full development.',
    },
    {
      text: 'What is the "golden ratio" in design?',
      options: ['1.618 — a proportion found in nature and art', 'A ratio of 1:1', '2:1 screen ratio', '50% split'],
      correctAnswer: 0,
      difficulty: 'hard',
      explanation: 'The golden ratio (≈1.618) creates aesthetically pleasing proportions in design.',
    },
    {
      text: 'What does "accessibility" mean in design?',
      options: ['Making products usable for people with disabilities', 'Easy to find locations', 'Affordable pricing', 'Fast loading'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'Accessibility ensures products can be used by people of all abilities.',
    },
    {
      text: 'What is responsive design?',
      options: ['Design that adapts to different screen sizes', 'Design that responds to user feedback', 'Fast-loading design', 'Interactive design'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'Responsive design adjusts layout and content to fit various devices and screen sizes.',
    },
    {
      text: 'What is the "fold" in web design?',
      options: ['The point where content requires scrolling', 'A paper folding technique', 'A design trend', 'A coding concept'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'The fold is the bottom of the visible screen area before scrolling.',
    },
    {
      text: 'What does "CTA" stand for?',
      options: ['Call to Action', 'Customer Total Analysis', 'Creative Testing Approach', 'Content Type Assessment'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'A CTA prompts users to take a specific action (buy, sign up, learn more).',
    },
  ],
  cybersecurity: [
    {
      text: 'What does a firewall do?',
      options: ['Monitors and filters network traffic', 'Prevents physical fires', 'Speeds up internet', 'Encrypts emails'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'A firewall acts as a barrier between trusted and untrusted networks, filtering traffic.',
    },
    {
      text: 'What is phishing?',
      options: ['Fraudulent attempt to obtain sensitive information', 'A fishing technique', 'A type of malware', 'Network scanning'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'Phishing uses deceptive emails or websites to steal personal information.',
    },
    {
      text: 'What does encryption do?',
      options: ['Converts data into unreadable code', 'Deletes sensitive files', 'Speeds up data transfer', 'Compresses files'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'Encryption transforms data into ciphertext that can only be read with the correct key.',
    },
    {
      text: 'What is two-factor authentication (2FA)?',
      options: ['Requiring two forms of verification to log in', 'Using two passwords', 'Logging in twice', 'Two security questions'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: '2FA adds a second verification step (like a phone code) beyond just a password.',
    },
    {
      text: 'What is a VPN?',
      options: ['Virtual Private Network — encrypts internet traffic', 'Very Private Network', 'Virus Protection Notification', 'Verified Public Node'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'A VPN creates an encrypted tunnel for your internet traffic, protecting your privacy.',
    },
    {
      text: 'What is a brute force attack?',
      options: ['Trying all possible password combinations', 'Physical force on hardware', 'DDoS attack', 'Social engineering'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'A brute force attack systematically tries every possible combination until the correct one is found.',
    },
    {
      text: 'What is malware?',
      options: ['Malicious software designed to harm systems', 'Good software', 'A type of firewall', 'An encryption method'],
      correctAnswer: 0,
      difficulty: 'easy',
      explanation: 'Malware includes viruses, worms, trojans, and ransomware designed to damage or exploit systems.',
    },
    {
      text: 'What is a zero-day exploit?',
      options: ['An attack on a previously unknown vulnerability', 'A very fast attack', 'An attack at midnight', 'A one-day free trial'],
      correctAnswer: 0,
      difficulty: 'hard',
      explanation: 'A zero-day exploit targets a vulnerability unknown to the software vendor.',
    },
    {
      text: 'What does HTTPS stand for?',
      options: ['HyperText Transfer Protocol Secure', 'High Tech Transfer Protocol Standard', 'Home Tool Transfer Protocol System', 'Hyperlink Text Transfer Protocol Simple'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'HTTPS is the secure version of HTTP, encrypting data between browser and server.',
    },
    {
      text: 'What is social engineering in cybersecurity?',
      options: ['Manipulating people into revealing confidential information', 'Building social networks', 'Engineering social media platforms', 'Creating social calendars'],
      correctAnswer: 0,
      difficulty: 'medium',
      explanation: 'Social engineering exploits human psychology rather than technical vulnerabilities.',
    },
  ],
};

// Initialize Firebase Admin using default credentials
initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

async function seedQuestions() {
  let totalSeeded = 0;

  for (const [categoryId, questions] of Object.entries(QUESTIONS)) {
    console.log(`\nSeeding ${categoryId}...`);
    for (const q of questions) {
      const docData = {
        ...q,
        categoryId,
        source: 'seed',
        sourceId: null,
        active: true,
        createdAt: new Date().toISOString(),
      };
      await db.collection('questions').add(docData);
      totalSeeded++;
      console.log(`  ✓ ${q.text.substring(0, 50)}...`);
    }
  }

  console.log(`\nDone! Seeded ${totalSeeded} questions across ${Object.keys(QUESTIONS).length} categories.`);
}

seedQuestions().catch(console.error);
