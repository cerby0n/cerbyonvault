type Props = {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
};

export default function CustomMenuButton({ onClick, label, icon }: Props) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer w-full text-start p-1 hover:bg-base-200 rounded flex items-center gap-2 text-base-content"
    >
      {icon && icon}
      {label}
    </button>
  );
}