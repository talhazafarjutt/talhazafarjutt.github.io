export enum ContactType {
  github = 'github',
  linkedin = 'linkedin',
  twitter = 'twitter',
  //youtube = 'youtube',
  email = 'email',
  //buymeacoffee = 'buymeacoffee',
  //googlescholar = 'googlescholar',
}

export interface Contact {
  twitter: string;
  site: string;
  calendly?: string;
  links: Record<ContactType, string>;
}

export const contact: Contact = {
  twitter: 'asadullahaut',
  site: 'muhammadasadullahtariq.github.io',
  calendly: 'https://calendly.com/asadullahtariq',
  links: {
    github: 'https://github.com/muhammadasadullahtariq',
    linkedin: 'https://linkedin.com/in/muhammadasadullahtariq',
    // googlescholar:
    //   'https://scholar.google.com/citations?user=8wIfeAsAAAAJ&hl=en',
    twitter: 'https://twitter.com/asadullahaut',
    //youtube: 'https://www.youtube.com/c/KaranPratapSingh',
    email: 'mailto:asadullahtariq89@gmail.com',
    // buymeacoffee: 'https://www.buymeacoffee.com/karanps',
  },
};
