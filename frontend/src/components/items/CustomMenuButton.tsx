type Props = {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
};

export default function CustomMenuButton({ onClick, label, icon }: Props) {
  return (
    <button
      onClick={onClick}
      className="cursor-pointer w-full text-start p-1 hover:bg-gray-100 rounded flex items-center gap-2"
    >
      {icon && icon}
      {label}
    </button>
  );
}