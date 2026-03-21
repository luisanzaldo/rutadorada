export interface AdminUser {
  username: string;
  passwordHash: string;
  displayName: string;
  letterboxdUrl: string;
}

export const USERS: AdminUser[] = [
  {
    username: 'luisanzaldo',
    passwordHash: '$2b$10$U3i4WCT0FXUNUjAnwa6YX./PAxQ/Grhqu57XFUqhidD48zyWbTYgq',
    displayName: 'Luis Anzaldo',
    letterboxdUrl: 'https://boxd.it/82ej9',
  },
  {
    username: 'ramonfigueroa',
    passwordHash: '$2b$10$DhXsL1W2OlW097WQOQyKIerb11QKpLqNK8tTVE9OF53nVkEqdWrAa',
    displayName: 'Moncho',
    letterboxdUrl: 'https://boxd.it/8jjEl',
  }
];
