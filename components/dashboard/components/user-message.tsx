type Props = {
  name?: string | null;
};

export const UserMessage = ({ name }: Props) => {
  return (
    <h2 className='text-3xl font-bold tracking-tight'>
      Hi, Welcome back <span className='text-muted-foreground'>{name}</span> 👋
    </h2>
  );
};
