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
  twitter: 'talhazafarjutt',
  site: 'talhazafarjutt.github.io',
  calendly: 'https://calendly.com/talha-zafar-j',
  links: {
    github: 'https://github.com/talhazafarjutt',
    linkedin: 'https://linkedin.com/in/talhazafarsoftwareengineer',
    // googlescholar:
    //   'https://scholar.google.com/citations?user=8wIfeAsAAAAJ&hl=en',
    twitter: 'https://twitter.com/talhazafarjutt',
    //youtube: 'https://www.youtube.com/c/KaranPratapSingh',
    email: 'mailto:talha.zafar.j@gmail.com',
    // buymeacoffee: 'https://www.buymeacoffee.com/karanps',
  },
};
