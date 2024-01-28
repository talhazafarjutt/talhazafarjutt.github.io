import { Maybe, Tuple } from '../types';
import { Stack } from './stack';

export type Deployment = {
  web?: string;
  android?: string;
  ios?: string;
};

export interface SubProject {
  title: string;
  description: string;
  repository: Maybe<string>;
  deployment: Deployment;
}

export const defaultDimensions: Tuple<number> = [450, 220];

export interface Project {
  title: string;
  slug: string;
  website: string;
  banner: string;
  description: string;
  shortDescription?: string;
  repository: Maybe<string>;
  stack: Stack[];
  dimensions?: Tuple<number>; // Tuple of [height, width]
  screenshots: string[];
  deployment: Deployment;
  subProjects: SubProject[];
}

export const projects: Project[] = [
  {
    title: 'Bring Life Hacks, Tips, Tricks',
    slug: 'Bring-Life-Hacks-Tips-Tricks',
    banner: '/static/projects/life/banner.png',
    website: 'https://bringhacks.com/',
    description:
      'Live smarter and better every day with Bring Hacks, your trusted lifehacker app with 10000+ (and growing) useful life hacks, tips and tricks.Upgrade your knowledge and intellect by viewing and saving bite-sized cool ideas from a vast source of tricks, shortcuts, and skills that help you increase productivity, and efficiency, and ultimately live better.',
    shortDescription:
      'Bring Life Hacks app is full of tricks, shortcuts, skills that help you increase productivity and efficiency.',
    repository: null,
    stack: [Stack.reactnative],
    dimensions: [592, 333],
    screenshots: [
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/life%201.webp?alt=media&token=8e71093c-548f-47ac-bba8-610e70412a88',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/life%202.webp?alt=media&token=0bf5c662-888d-4e42-9c45-8242850866ef',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/life%203.webp?alt=media&token=2efeb650-2a34-4c64-923f-7195ae335236',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/life%204.webp?alt=media&token=b4912235-5e24-4da2-8716-e40d0f85c44e',
    ],
    deployment: {
      web: 'https://bringhacks.com/',
      android:
        'https://play.google.com/store/apps/details?id=rish.crearo.lifehacks&hl=en&gl=US',
    },
    subProjects: [],
  },
  {
    title: 'Oonee',
    slug: 'oonee',
    banner: '/static/projects/oonee/banner.png',
    website: 'https://www.oonee.us/',
    description: `Access a growing network of free to use bike parking & charging stations in metro New York/NJ. Developed by transportation advocates in partnership with the community.

This version is a beta, please do share your feedback!

- Registration: Easy, Seamless Account Management
- Access: Fast Lock & Unlock at stations
- More Secure & Convenient: Use self-locking bike racks, available at select stations`,
    shortDescription: 'Better Bike Infrastructure is Possible',
    repository: null,
    stack: [Stack.reactnative, Stack.react],
    screenshots: [
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/oonee.webp?alt=media&token=d35ecc2c-c3e8-4bd9-a237-9623da97f0a3',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/oonee%202.webp?alt=media&token=406e511d-1430-4c37-817c-f49b44d82a6e',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/oonne.webp?alt=media&token=fcee9129-15cb-46e3-a928-00cc43b54ed7',
    ],
    deployment: {
      web: 'https://www.oonee.us/',
      android: 'https://play.google.com/store/apps/details?id=com.oonee',
      ios: 'https://apps.apple.com/us/app/oonee/id1630930929',
    },
    subProjects: [],
  },
  {
    title: 'EV Connect Hub',
    slug: 'ev-connect-hub',
    website: 'https://evconnect.smartexsolution.com/',
    banner: '/static/projects/ev/banner.png',
    description:
      'Discover a detailed map of nearby electric vehicle(EV) charging stations, including both charging stations that are available to the public and those that are privately registered by individuals. Customize your search by applying filters for distance, availability, and charging speeds, ensuring a seamless charging experience for your electric vehicle.Book Charging slots :Book your preferred ev charging spots ahead of time to make sure they are available when you get there. You wont have to wait in line or worry about finding an open spot anymore',
    repository: null,
    stack: [
      Stack.reactnative,
      Stack.node,
      Stack.mongo,
      Stack.Firebase,
      Stack.javascript,
    ],
    screenshots: [
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/ev%201.png?alt=media&token=79ecb852-9461-4910-935a-1fa2b35274ce',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/ev%202.png?alt=media&token=e0c46300-f0aa-4fcd-b0fa-df34ebd026d6',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/ev%203.jpeg?alt=media&token=309abdb2-ff86-40d7-9f74-39465dee1239',
    ],
    deployment: {
      web: 'https://evconnect.smartexsolution.com/',
      android:
        'https://play.google.com/store/apps/details?id=com.smartexsolutions.evconnecthub',
      ios: 'https://apps.apple.com/us/app/ev-connecthub/id6458836437',
    },
    subProjects: [],
  },
  {
    title: 'Classic Food Delievery',
    slug: 'classic-food-delievery',
    banner: '/static/projects/classic/banner.jpeg',
    website: null,
    description: `The Classic Food Delivery application is a comprehensive solution for restaurants. It includes mobile applications for both Android and iOS, which customers can use to place orders. The restaurant then uses a web application to manage these orders, their menu, and other aspects. Additionally, there is an admin panel where the administrator can manage all branches, restaurants, and users.`,
    repository: null,
    dimensions: [746, 1000],
    stack: [
      Stack.javascript,
      Stack.react,
      Stack.reactnative,
      Stack.graphql,
      Stack.node,
      Stack.typescript,
      Stack.Firebase,
    ],
    screenshots: [
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/food.png?alt=media&token=12e11a70-ae40-4cdb-91c4-eda1874dfc37',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/resturant.png?alt=media&token=f47eeb70-7312-4936-a30b-6fb8caaa287d',
    ],
    deployment: {
      web: 'https://boom.london',
      android: 'https://play.google.com/store/apps/details?id=app.boom.mobile',
    },
    subProjects: [],
  },
  {
    title: 'ComposeTrip',
    slug: 'composetrip',
    website: 'https://www.composetrip.com/',
    repository: null,
    banner: '/static/projects/composetrip/banner.png',
    description:
      'Get a tailored itinerary specific to you and experience the magic of personalized adventures.',
    stack: [
      Stack.javascript,
      Stack.react,
      Stack.reactnative,
      Stack.aws,
      Stack.Firebase,
      Stack.node,
      Stack.prompt,
      Stack.openAI,
      Stack.mongo,
    ],
    screenshots: [
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/Screen%20Shot%202024-01-28%20at%204.51.56%20PM.png?alt=media&token=91d7607d-58c2-4909-beac-836a99c52c68',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/Screen%20Shot%202024-01-28%20at%204.52.18%20PM.png?alt=media&token=06ab85a1-821e-48ac-9f63-d22445ba4896',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/Screen%20Shot%202024-01-28%20at%204.52.29%20PM.png?alt=media&token=de2e5015-fde6-48b5-ae1b-e366b8b02ce2',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/Screen%20Shot%202024-01-28%20at%204.53.17%20PM.png?alt=media&token=78ec7321-65fb-4c13-9346-fa8a23ccbe12',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/Screen%20Shot%202024-01-28%20at%204.53.30%20PM.png?alt=media&token=eeaa9475-4fac-4954-ae14-41a1ce0557d7',
    ],
    dimensions: [451, 720],
    deployment: {
      web: 'https://www.composetrip.com/',
    },
    subProjects: [],
  },
  {
    title: 'SmartNodes',
    slug: 'smartnodes',
    website: 'https://smartnodes.family/',
    banner: '/static/projects/smartnode/banner.jpeg',
    description:
      'Your gateway to decentralized networks. SmartNodes supports proof-of-stake blockchains by providing enterprise grade validator services. Get rewarded by staking your crypto assets with us. Its fast, its easy, its secure.',
    repository: null,
    stack: [Stack.react, Stack.nextjs, Stack.node, Stack.mongo],
    dimensions: [450, 270],
    screenshots: [],
    deployment: {
      web: 'https://smartnodes.family/about',
    },
    subProjects: [],
  },
  {
    title: 'Links',
    slug: 'links',
    banner: '/static/projects/links/banner.png',
    description:
      'Streamline your online experience with our Link Saver and Hashtag Generator app. Tired of losing track of valuable links? Our Link Saver app allows you to effortlessly save and categorize your favorite websites, articles, images, videos, books, movies, social media, and other resources in one convenient location. Stay organized and access your links with ease, whether its for work, research, or personal interests.But thats not all – supercharge your social media networks with our Hashtag Generator Feature. Crafting engaging hashtags has never been simpler. The app analyzes your content and suggests trending and relevant hashtags, helping you maximize your posts reach and impact. Whether youre a social media enthusiast, influencer, or business owner, our Hashtag Generator ensures your content stands out in the crowded online space. Simplify your digital life, boost your productivity, and enhance your social media presence – all in one app. Download now and experience the power of efficient link management and dynamic hashtag creation. Elevate your online journey with Link Saver and Hashtag Generator app.',
    repository: null,
    stack: [
      Stack.react,
      Stack.reactnative,
      Stack.node,
      Stack.mongo,
      Stack.github,
      Stack.Firebase,
      Stack.mongo,
      Stack.javascript,
    ],
    dimensions: [800, 370],
    screenshots: [
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/link%201.png?alt=media&token=43abd289-eb05-4b51-975d-3b089eb0ffb0',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/link%202.png?alt=media&token=5792f8d3-f2e1-49fe-9b4e-9a9119298e2e',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/link%203.png?alt=media&token=e51216ce-3556-4c33-8bff-de59e8f436d2',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/link%204.png?alt=media&token=3bdc7b3b-d1ac-4f7f-b763-856d4201916b',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/screen%208%20(4).png?alt=media&token=29d49aa7-fad9-4cff-b02a-0203efa35e7b',
    ],
    deployment: {
      android:
        'https://play.google.com/store/apps/details?id=com.smartexsulution.lin',
      ios: 'https://apps.apple.com/us/app/link-saver-hashtag-generator/id6467019637',
    },
    website: null,
    subProjects: [],
  },
  {
    title: 'Cherish BuZZ',
    slug: 'cherish-buzz',
    banner: '/static/projects/cherish/banner.png',
    description:
      '“Easy Reminders & Events: Zodiac Love” is a comprehensive application designed to celebrate and plan events for your loved ones based on their zodiac signs. It allows users to add contact information and zodiac signs of their loved ones, set reminders for birthdays, anniversaries, and other events, and receive advance notifications. The app provides daily, weekly, and monthly horoscopes for each contact, insights into their personality traits, compatibility, and love language, and helps plan events that suit their zodiac preferences. Users can also send personalized messages and greetings with zodiac emojis and stickers. Beyond being a reminder app, it offers a fun and easy way to show appreciation to friends, family, and partners, and serves as a tool to learn more about oneself and one’s zodiac sign.',
    repository: null,
    stack: [Stack.react, Stack.reactnative, Stack.node, Stack.mongo],
    dimensions: [800, 370],
    screenshots: [
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/cherish%201.png?alt=media&token=46142e40-2158-41ee-b84a-4dda2bf2ea22',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/cherish%202.png?alt=media&token=11b929c9-2b86-40ff-9e1f-2891bc867630',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/cherish%203.png?alt=media&token=3582c865-672d-4d22-a1fd-45b465df4e9f',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/cherish%204.png?alt=media&token=7a2901fe-67b5-42bb-b47c-07d222204fb8',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/cherish%205.png?alt=media&token=90229e8a-b764-4377-b201-488dccf6c2b5',
    ],
    deployment: {
      android:
        'https://play.google.com/store/apps/details?id=com.smartexsolution.birthdays',
      ios: 'https://apps.apple.com/us/app/cherish-buzz-event-reminder/id6475199844',
    },
    website: null,
    subProjects: [],
  },
  {
    title: 'Sort Math',
    slug: 'sort-math',
    banner: '/static/projects/sortMath/banner.png',
    description:
      'SortIt: Fun sorting challenges for kids & adults! Teach, learn, and sort alphabet, numbers, and more. Educational and entertaining!\nElevate learning to a whole new level with SortIt, the interactive sorting app designed for both kids and adults. Transform ordinary sorting tasks into exciting challenges and educational adventures. Explore a world of possibilities:\nAlphabet Sorting: Arrange letters from A to Z, both in uppercase and lowercase. Foster early literacy skills and boost alphabet recognition.\nNumber Sorting: Dive into the world of numbers with natural, whole, prime, decimal, binary, hexadecimal, and octal number sorting.\nTime Trials: Challenge your speed and accuracy! Compete against the clock to sort items as quickly as possible. Sharpen your sorting skills and beat your own records.\nRandom Sorting: Keep things exciting with random assortments. Test your ability to adapt and organize on the fly.\nRoman Numerals: Discover the fascinating world of Roman numerals and enhance your numeracy.',
    repository: null,
    stack: [Stack.react, Stack.reactnative],
    dimensions: [800, 370],
    screenshots: [
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/sort%20math.png?alt=media&token=7ae23208-23ae-43c6-9ec7-d09204b08be8',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/sort%202.png?alt=media&token=4aec6bce-7034-4cfd-be48-8caf05bbd069',
      'https://firebasestorage.googleapis.com/v0/b/classic-277cc.appspot.com/o/sort%203.png?alt=media&token=a85dd2a0-69c0-4e2b-9562-6ea395bfe8a3',
    ],
    deployment: {
      android:
        'https://play.google.com/store/apps/details?id=smartexsolution.sortmath',
      ios: 'https://apps.apple.com/us/app/sort-math/id6462795884',
    },
    website: 'https://kcards-server.herokuapp.com',
    subProjects: [],
  },
];
