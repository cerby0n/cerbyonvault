import { useEffect, useState, useRef } from "react";
import { useExportActions } from "../hooks/useExportActions";
import CustomMenuButton from "./items/CustomMenuButton";
import { ChevronRight, FileText, Copy, Download } from "lucide-react";

type CertificateContextMenuProps = {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  certId: number;
  certName: string;
  hasPrivateKey: boolean;
  onExportClick: (certId: number, certName: string) => void;
};

export default function CertificateContextMenu({
  x,
  y,
  visible,
  onClose,
  certId,
  onExportClick,
  certName,
  hasPrivateKey,
}: CertificateContextMenuProps) {
  const { buildExportUrl, copyToClipboard } = useExportActions();
  if (!visible) return null;
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuDirection, setMenuDirection] = useState<"right" | "left">("right");
  useEffect(() => {
    if (visible && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      if (x + menuRect.width > windowWidth) {
        setMenuDirection("left");
      } else {
        setMenuDirection("right");
      }
    }
  }, [x, visible]);

  const handleClipboard = async (variant: string) => {
    const url = buildExportUrl(certId, variant, "pem");
    await copyToClipboard(url);
    onClose();
  };

  const SubMenu = ({
    title,
    icon,
    children,
  }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div className="relative group">
      <button className="w-full text-left p-1 cursor-pointer hover:bg-base-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            {title}
          </div>
          <ChevronRight size={15} />
        </div>
      </button>
      <div
        className="absolute left-full top-0 z-50  bg-base-100 outline outline-accent/20 rounded shadow-md p-2 hidden group-hover:flex flex-col space-y-1 w-40"
      >
        <div className="flex flex-col min-w-max items-start">{children}</div>
      </div>
    </div>
  );

  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [onClose]);

  const menuStyle =
    menuDirection === "right" ? { top: y, left: x } : { top: y, left: x - 260 };

  return (
    <div
      ref={menuRef}
      className="absolute bg-base-100 shadow-md outline outline-accent/20 p-3 rounded z-50 w-64"
      style={menuStyle}
    >
      <h3 className="font-bold mb-2 flex items-center gap-2">
        <FileText size={18} />
        Export Options
      </h3>
      <SubMenu title="Copy to Clipboard" icon={<Copy size={16} />}>
        <CustomMenuButton
          onClick={() => handleClipboard("cert")}
          label="Cert"
        />
        {hasPrivateKey && (
          <CustomMenuButton
            onClick={() => handleClipboard("cert+key")}
            label="Cert + Key"
          />
        )}
        <CustomMenuButton
          onClick={() => handleClipboard("chain")}
          label="Chain"
        />
        {hasPrivateKey && (
          <CustomMenuButton
            onClick={() => handleClipboard("chain+key")}
            label="Chain + Key"
          />
        )}
      </SubMenu>
      <CustomMenuButton
        onClick={() => {
          onExportClick(certId, certName);
        }}
        label="Download File"
        icon={<Download size={16} />}
      />
    </div>
  );
}
