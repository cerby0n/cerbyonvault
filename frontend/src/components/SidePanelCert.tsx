import { useEffect, useState } from "react";
import { Certificate, Team } from "../types";
import TeamsSelect from "../utils/TeamsSearch";
import WebsitesManager from "./items/WebsitesManager";
import { useCertService } from "../utils/useCertService";
import { formatDate } from "../utils/utils";
import { InputCopy } from "./items/InputCopy";
import {
  FileBadge,
  X,
  Info,
  Key,
  FileText,
  ShieldCheck,
} from "lucide-react";


interface SidePanelCertProps {
  isOpen: boolean;
  onClose: () => void;
  data: { cert?: Certificate };
  onUpdated: () => void;
}

export default function SidePanelCert({
  isOpen,
  onClose,
  data,
  onUpdated,
}: SidePanelCertProps) {
  const { updateCertificate } = useCertService();
  const [activeSan, setActiveSan] = useState<string | null>(null);
  const [name, setName] = useState<string>(data?.cert?.name || "");
  const [comment, setComment] = useState<string>(data?.cert?.comment || "");
  const [accessTeams, setAccessTeams] = useState<Team[]>(
    data.cert?.access_teams || []
  );

  useEffect(() => {
    if (data.cert) {
      setName(data.cert.name);
      setComment(data.cert.comment || "");
      setAccessTeams(data.cert.access_teams);
    }
  }, [data.cert]);

  if (!isOpen || !data.cert) return null;

  const handleUpdate = async () => {
    try {
      const payload = {
        name,
        comment,
        access_teams: accessTeams.map((t) => t.id),
      };
      await updateCertificate(data.cert!.id, payload);
      onClose();
      onUpdated();
    } catch (err) {
      console.error("Failed to udpdate certificate:", err);
    }
  };

  const handleClick = (san: string) => {
    navigator.clipboard.writeText(san).then(() => {
      setActiveSan(san);
      setTimeout(() => setActiveSan(null), 1000);
    });
  };

  // Extract IPs from SANs
  const ipAddresses = data.cert.san.filter(san =>
    /^(\d{1,3}\.){3}\d{1,3}$/.test(san) || /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(san)
  );

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] select-none">
      {/* Header with Close Button */}
      <div className="flex justify-between items-center p-4 pb-2 flex-shrink-0">
        <h2 className="text-xl font-bold text-base-content">Certificate Details</h2>
        <button onClick={onClose} className="all-[unset]">
          <X
            size={24}
            strokeWidth={2.5}
            className="text-base-content/60 cursor-pointer transition-all hover:text-error hover:rotate-90"
          />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">

      {/* Certificate Name - Editable */}
      <div className="bg-base-200/50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <FileBadge size={18} className="text-primary" />
          <label className="text-xs font-semibold text-base-content/70 uppercase">Certificate Name</label>
        </div>
        <input
          className="w-full bg-base-100 border border-base-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Certificate Name"
        />
      </div>

      {/* CERTIFICATE INFORMATION SECTION */}
      <div className="bg-base-200/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-base-300">
          <Info size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-base-content uppercase tracking-wide">Certificate Information</h3>
        </div>

        {/* Subject */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-base-content/70">Subject</label>
          <InputCopy value={data.cert.subject} />
        </div>

        {/* Issuer */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-base-content/70">Issuer</label>
          <InputCopy value={data.cert.issuer} />
        </div>

        {/* Serial Number */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-base-content/70">Serial Number</label>
          <InputCopy value={data.cert.serial_number} />
        </div>

        {/* Certificate Type & Has Private Key */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">Certificate Type</label>
            <div className="bg-base-100 border border-base-300 rounded-md px-3 py-2 text-sm">
              {data.cert.certificate_type}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">Private Key</label>
            <div className={`flex items-center gap-2 bg-base-100 border rounded-md px-3 py-2 text-sm ${data.cert.has_private_key ? 'border-success text-success' : 'border-base-300 text-base-content/60'}`}>
              <Key size={14} />
              <span>{data.cert.has_private_key ? 'Available' : 'Not Available'}</span>
            </div>
          </div>
        </div>

        {/* Validity Period */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">Not Before</label>
            <div className="bg-base-100 border border-base-300 rounded-md px-3 py-2 text-sm">
              {formatDate(data.cert.not_before)}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">Not After</label>
            <div className={`bg-base-100 border rounded-md px-3 py-2 text-sm ${data.cert.is_expired ? 'border-error text-error' : 'border-success text-success'}`}>
              {formatDate(data.cert.not_after)}
            </div>
          </div>
        </div>

        {/* Public Key Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">Public Key Type</label>
            <div className="bg-base-100 border border-base-300 rounded-md px-3 py-2 text-sm">
              {data.cert.public_key_type}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-base-content/70">Key Length</label>
            <div className="bg-base-100 border border-base-300 rounded-md px-3 py-2 text-sm">
              {data.cert.public_key_length} bits
            </div>
          </div>
        </div>

        {/* Signature Algorithm */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-base-content/70">Signature Algorithm</label>
          <div className="bg-base-100 border border-base-300 rounded-md px-3 py-2 text-sm">
            {data.cert.signature_algorithm}
          </div>
        </div>

        {/* Certificate Hash */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-base-content/70">Certificate Hash (SHA-256)</label>
          <InputCopy value={data.cert.cert_hash} />
        </div>

        {/* Subject Alternative Names */}
        {data.cert.san.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-base-content/70">Subject Alternative Names ({data.cert.san.length})</label>
            <div className="bg-base-100 border border-base-300 rounded-md p-3 max-h-40 overflow-y-auto">
              <div className="grid grid-cols-1 gap-1.5">
                {data.cert.san.map((san) => {
                  const isActive = activeSan === san;
                  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(san) || /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(san);
                  return (
                    <button
                      key={san}
                      onClick={() => handleClick(san)}
                      className={`text-left px-2 py-1.5 rounded text-xs font-mono transition-all ${
                        isActive
                          ? "bg-primary/20 ring-1 ring-primary text-primary"
                          : "bg-base-200 hover:bg-base-300 text-base-content"
                      }`}
                    >
                      {isIP && <span className="text-info mr-1">🌐</span>}
                      {san}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* IP Addresses (extracted from SANs) */}
        {ipAddresses.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-base-content/70">IP Addresses ({ipAddresses.length})</label>
            <div className="bg-base-100 border border-base-300 rounded-md p-3">
              <div className="flex flex-wrap gap-2">
                {ipAddresses.map((ip) => (
                  <div
                    key={ip}
                    className="px-3 py-1 bg-info/10 text-info border border-info/30 rounded-full text-xs font-mono"
                  >
                    {ip}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ADDITIONAL INFORMATION SECTION */}
      <div className="bg-base-200/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-base-300">
          <FileText size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-base-content uppercase tracking-wide">Additional Information</h3>
        </div>

        {/* Comment */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-base-content/70">Comment</label>
          <textarea
            className="w-full bg-base-100 border border-base-300 rounded-md px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment or notes..."
          />
        </div>

        {/* Websites */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-base-content/70">Linked Websites</label>
          <WebsitesManager
            certId={data.cert.id}
            initialWebsites={data.cert.websites}
            onWebsitesUpdated={onUpdated}
          />
        </div>

        {/* Teams */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-base-content/70">Assigned Teams</label>
          <TeamsSelect value={accessTeams} onChange={setAccessTeams} />
        </div>
      </div>
      </div>

      {/* Update Button - Fixed at bottom */}
      <div className="flex-shrink-0 bg-base-100 p-4 pt-3 border-t border-base-300">
        <button className="btn btn-primary w-full" onClick={handleUpdate}>
          <ShieldCheck size={18} />
          Update Certificate
        </button>
      </div>
    </div>
  );
}
