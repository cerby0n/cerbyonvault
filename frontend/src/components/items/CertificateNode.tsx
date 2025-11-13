import { PiCertificateThin } from "react-icons/pi";
import { Certificate } from "../../types";

interface CertificateNodeProps {
  cert: Certificate;
}

export default function CertificateNode({ cert }: CertificateNodeProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="flex justify-between items-center select-none text-secondary-content py-1">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <PiCertificateThin size={24} strokeWidth={8} className="flex-shrink-0" />
        <div className="text-sm font-medium truncate">{cert.name}</div>
      </div>

      <div className="flex items-center gap-6 flex-shrink-0">
        <div className="text-xs text-base-content/60 whitespace-nowrap min-w-[100px]">
          {formatDate(cert.not_after)}
        </div>

        <div className="flex items-center gap-1.5 mr-4 min-w-[80px]">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              cert.is_expired ? "bg-error" : "bg-success"
            }`}
          ></span>
          <div
            className={`text-xs font-semibold ${
              cert.is_expired ? "text-error" : "text-success"
            }`}
          >
            {cert.is_expired ? "Expired" : "Valid"}
          </div>
        </div>
      </div>
    </div>
  );
}
