import { Colors } from './colors';

export enum Stack {
  // Languages
  go,
  typescript,
  javascript,
  python,

  // Frontend
  react,
  reactnative,
  nextjs,

  // Backend
  graphql,
  node,
  django,

  // Cloud
  aws,
  gcp,

  // Messaging
  nats,
  kafka,

  // Databases
  arangodb,
  redis,
  postgres,
  mongo,
  realm,
  Firebase,

  // Tools
  docker,
  kubernetes,
  terraform,
  github,
  prompt,
  openAI,
  npm,
}

export const WorkStack = [
  Stack.reactnative,
  Stack.react,
  Stack.nextjs,
  Stack.node,
  Stack.mongo,
  Stack.Firebase,
  Stack.realm,
  Stack.javascript,
  Stack.github,
  Stack.prompt,
  Stack.openAI,
  Stack.npm,
  Stack.typescript,
  Stack.aws,
  Stack.graphql,
  Stack.postgres,
];

type StackInfoMap = {
  value: string;
  color: string;
};

export const StackInfo: Record<Stack, StackInfoMap> = {
  [Stack.typescript]: {
    value: 'TypeScript',
    color: Colors.typescript,
  },
  [Stack.javascript]: {
    value: 'JavaScript',
    color: Colors.javascript,
  },
  [Stack.go]: {
    value: 'Service Oriented Architecture',
    color: Colors.go,
  },
  [Stack.react]: {
    value: 'Micro Services',
    color: Colors.react,
  },
  [Stack.reactnative]: {
    value: 'gRPC',
    color: Colors.reactnative,
  },
  [Stack.nextjs]: {
    value: 'Nestjs',
    color: Colors.nextjs,
  },
  [Stack.graphql]: {
    value: 'GraphQL',
    color: Colors.graphql,
  },
  [Stack.aws]: {
    value: 'AWS',
    color: Colors.aws,
  },
  [Stack.gcp]: {
    value: 'Google Cloud',
    color: Colors.gcp,
  },
  [Stack.python]: {
    value: 'Python',
    color: Colors.python,
  },
  [Stack.node]: {
    value: 'Node',
    color: Colors.node,
  },
  [Stack.django]: {
    value: 'Django',
    color: Colors.django,
  },
  [Stack.nats]: {
    value: 'FastAPI',
    color: Colors.nats,
  },
  [Stack.kafka]: {
    value: 'Flask',
    color: Colors.kafka,
  },
  [Stack.arangodb]: {
    value: 'SQL',
    color: Colors.arangodb,
  },
  [Stack.postgres]: {
    value: 'NoSQL',
    color: Colors.postgres,
  },
  [Stack.redis]: {
    value: 'Redis',
    color: Colors.redis,
  },
  [Stack.mongo]: {
    value: 'MongoDB',
    color: Colors.mongo,
  },
  [Stack.Firebase]: {
    value: 'Firebase',
    color: Colors.kafka,
  },
  [Stack.realm]: {
    value: 'Realm',
    color: Colors.redux,
  },
  [Stack.docker]: {
    value: 'Docker',
    color: Colors.docker,
  },
  [Stack.kubernetes]: {
    value: 'CI/CD',
    color: Colors.kubernetes,
  },
  [Stack.terraform]: {
    value: 'Terraform',
    color: Colors.terraform,
  },
  [Stack.openAI]: {
    value: 'yarn',
    color: Colors.opensource,
  },
  [Stack.prompt]: {
    value: 'Prompt Engineering',
    color: Colors.javascript,
  },
  [Stack.npm]: {
    value: 'NPM',
    color: Colors.node,
  },
  [Stack.github]: {
    value: 'git',
    color: Colors.git,
  },
};
