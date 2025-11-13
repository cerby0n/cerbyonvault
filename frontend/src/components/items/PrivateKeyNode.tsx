import { FaKey } from "react-icons/fa";
import { PiCertificateThin } from "react-icons/pi";
import { PrivateKey } from "../../types";

interface PrivateKeyNodeProps {
  privateKey: PrivateKey;
  selectedIds: number[];
  onClick: (e: React.MouseEvent, privateKey: PrivateKey, selectedIds: number[]) => void;
  onDoubleClick: () => void;
}

export default function PrivateKeyNode({
  privateKey,
  selectedIds,
  onClick,
  onDoubleClick,
}: PrivateKeyNodeProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const isSelected = selectedIds.includes(privateKey.id);
  return (
    <li>
      <div
        onClick={(e) => onClick(e, privateKey, selectedIds)}
        onDoubleClick={onDoubleClick}
        className={`cursor-pointer border-b border-neutral/75 hover:rounded hover:bg-secondary/25 hover:border-none mr-2 py-1 ${
          isSelected ? "bg-secondary/25  border-none rounded " : ""
        }`}
      >
        <div className="flex justify-between items-center select-none text-secondary-content">
          <div className="ml-5 flex items-center gap-2 flex-1 min-w-0">
            <FaKey size={20} className="flex-shrink-0" />
            <div className="text-sm font-medium truncate">{privateKey.name}</div>
          </div>

          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-xs text-base-content/60 whitespace-nowrap min-w-[100px]">
              {formatDate(privateKey.created_at)}
            </div>

            {privateKey.certificate && (
              <div className="flex items-center gap-1.5 min-w-[150px]">
                <PiCertificateThin size={18} strokeWidth={8} className="flex-shrink-0" />
                <div className="text-xs truncate">
                  {privateKey.certificate?.name}
                </div>
              </div>
            )}

            <div className="text-xs font-medium mr-4 min-w-[80px] text-right">
              {privateKey.keysize} bits
            </div>
          </div>
        </div>

      </div>
    </li>
  );
}
