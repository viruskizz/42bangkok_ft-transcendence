import { User } from '@entities/user.entity'

const userSeed: Partial<User>[] = [
  {
    id: 1,
    intraId: 1,
    firstName: 'Thitiwut',
    lastName: 'Somsa',
    email: 'thitiwut@student.42bangkok.com',
  },
  {
    id: 2,
    intraId: 2,
    firstName: 'Araiva',
    lastName: 'Viruskizz',
    email: 'viruskizz@student.42bangkok.com',
  },
  {
    id: 3,
    intraId: 3,
    firstName: 'Araiva',
    lastName: 'Leonhart',
    email: 'araiva@student.42bangkok.com',
  },
];

export default userSeed;