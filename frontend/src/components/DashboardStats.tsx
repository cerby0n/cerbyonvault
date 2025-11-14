import React, { useState, useEffect } from "react";
import useAxios from "../axios/useAxios";
import dayjs from "dayjs";
import { IoWarning } from "react-icons/io5";
import { AiFillSafetyCertificate } from "react-icons/ai";
import { BsFileEarmarkExcelFill, BsFileEarmarkCheckFill } from "react-icons/bs";
import { MdLock, MdLockOpen, MdLockClock } from "react-icons/md";
import { useNavigate } from "react-router-dom";

type StatKey = "expired" | "valid" | "expiring";
type SecretStatKey = "secret-expired" | "secret-valid" | "secret-expiring";

const daysOptions = [7, 30];

type Certificate = {
  id: number;
  name: string;
  subject: string;
  not_after: string;
};

type Secret = {
  id: number;
  name: string;
  application: string;
  expiry_date: string | null;
  is_expired: boolean;
};

type StatConfig = {
  key: StatKey;
  title: string;
  icon: React.ReactNode;
  value?: number;
  loading: boolean;
};

export const DashboardStats: React.FC = () => {
  const axios = useAxios();

  const [overview, setOverview] = useState<{
    total_certificates: number;
    expired_certificates: number;
    valid_certificates: number;
  } | null>(null);
  const [secretsOverview, setSecretsOverview] = useState<{
    total_secrets: number;
    expired_secrets: number;
    valid_secrets: number;
    no_expiry_secrets: number;
  } | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingSecretsOverview, setLoadingSecretsOverview] = useState(true);
  const [loadingExpiring, setLoadingExpiring] = useState(true);
  const [loadingSecretsExpiring, setLoadingSecretsExpiring] = useState(true);
  const [loadingTopExpiry, setLoadingTopExpiry] = useState(true);
  const [loadingList, setLoadingList] = useState(false);

  // For showing certificate list
  const [days, setDays] = useState(daysOptions[1]);
  const [selectedStat, setSelectedStat] = useState<StatKey | null>(null);
  const [selectedSecretStat, setSelectedSecretStat] = useState<SecretStatKey | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<number | null>(null);
  const [secretsExpiringSoon, setSecretsExpiringSoon] = useState<number | null>(null);
  const [topExpiry, setTopExpiry] = useState<Certificate[]>([]);
  const [loadingSecretsList, setLoadingSecretsList] = useState(false);

  useEffect(() => {
    if (!selectedStat) return;
    setLoadingList(true);
    let url = "/dashboard/certificates-list/?type=" + selectedStat;
    if (selectedStat === "expiring") {
      url += `&days=${days}`;
    }
    axios
      .get(url)
      .then((res) => setCertificates(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCertificates([]))
      .finally(() => setLoadingList(false));
  }, [selectedStat, days]);

  useEffect(() => {
    if (!selectedSecretStat) return;
    setLoadingSecretsList(true);
    const type = selectedSecretStat.replace("secret-", "");
    let url = "/dashboard/secrets-list/?type=" + type;
    if (selectedSecretStat === "secret-expiring") {
      url += `&days=${days}`;
    }
    axios
      .get(url)
      .then((res) => setSecrets(Array.isArray(res.data) ? res.data : []))
      .catch(() => setSecrets([]))
      .finally(() => setLoadingSecretsList(false));
  }, [selectedSecretStat, days]);

  useEffect(() => {
    setLoadingTopExpiry(true);
    axios
      .get("/dashboard/certificates-top-expiry/?limit=20")
      .then((res) => setTopExpiry(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTopExpiry([]))
      .finally(() => setLoadingTopExpiry(false));
  }, []);

  useEffect(() => {
    setLoadingOverview(true);
    axios
      .get("/dashboard/certificates-overview/")
      .then((res) => setOverview(res.data))
      .catch(() => setOverview(null))
      .finally(() => setLoadingOverview(false));
  }, []);

  useEffect(() => {
    setLoadingExpiring(true);
    axios
      .get(`/dashboard/certificates-expiring-soon/?days=${days}`)
      .then((res) => setExpiringSoon(res.data.expiring_soon_certificates))
      .catch(() => setExpiringSoon(null))
      .finally(() => setLoadingExpiring(false));
  }, [days]);

  useEffect(() => {
    setLoadingSecretsOverview(true);
    axios
      .get("/dashboard/secrets-overview/")
      .then((res) => setSecretsOverview(res.data))
      .catch(() => setSecretsOverview(null))
      .finally(() => setLoadingSecretsOverview(false));
  }, []);

  useEffect(() => {
    setLoadingSecretsExpiring(true);
    axios
      .get(`/dashboard/secrets-expiring-soon/?days=${days}`)
      .then((res) => setSecretsExpiringSoon(res.data.expiring_soon_secrets))
      .catch(() => setSecretsExpiringSoon(null))
      .finally(() => setLoadingSecretsExpiring(false));
  }, [days]);

  const stats: StatConfig[] = [
    {
      key: "valid",
      title: "Valid Certificates",
      icon: <BsFileEarmarkCheckFill className="text-success" />,
      value: overview?.valid_certificates,
      loading: loadingOverview,
    },
    {
      key: "expired",
      title: "Expired Certificates",
      icon: <BsFileEarmarkExcelFill className="text-error" />,
      value: overview?.expired_certificates,
      loading: loadingOverview,
    },
    {
      key: "expiring",
      title: `Expiring in ${days} days`,
      icon: <IoWarning className="text-warning text-2xl" />,
      value: expiringSoon ?? undefined,
      loading: loadingExpiring,
    },
  ];

  // Toggle: Clicking the same tile closes the table
  function handleStatClick(key: StatKey) {
    setSelectedStat((prev) => (prev === key ? null : key));
    setSelectedSecretStat(null); // Clear secret stat when cert stat is clicked
  }

  function handleSecretStatClick(key: SecretStatKey) {
    setSelectedSecretStat((prev) => (prev === key ? null : key));
    setSelectedStat(null); // Clear cert stat when secret stat is clicked
  }

  return (
    <div className="w-full flex flex-col">
      <div className="p-6 bg-base-100 rounded top-0 items-center mb-2 flex justify-between">
        <h1 className="text-4xl font-bold text-secondary-content">Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-base-content/70 font-medium">Expiry Period:</span>
          <div className="flex gap-2">
            {[7, 30].map((d) => (
              <button
                key={d}
                type="button"
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  days === d
                    ? "bg-warning text-warning-content font-bold"
                    : "bg-neutral/10 text-neutral hover:bg-warning hover:text-warning-content"
                }`}
                onClick={() => setDays(d)}
              >
                {d} days
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className=" flex-1 flex flex-col bg-base-100 p-4 rounded shadow space-y-4">
        {/* Certificates Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-base-content/70 border-b border-base-300 pb-2">Certificates</h2>
          <div className="grid gap-4 grid-cols-1">
            <StatCard
              title="Total Certificates"
              icon={<AiFillSafetyCertificate size={24} className="text-accent" />}
              value={overview?.total_certificates}
              loading={loadingOverview}
              onClick={() => setSelectedStat(null)}
            />
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            {stats.map((stat) => (
              <StatCard
                key={stat.key}
                title={stat.title}
                value={stat.value}
                loading={stat.loading}
                icon={stat.icon}
                onClick={() => handleStatClick(stat.key)}
                active={selectedStat === stat.key}
              />
            ))}
          </div>
        </div>

        {/* Secrets Section */}
        <div className="space-y-4 pt-4">
          <h2 className="text-2xl font-bold text-base-content/70 border-b border-base-300 pb-2">Secrets</h2>
          <div className="grid gap-4 grid-cols-1">
            <StatCard
              title="Total Secrets"
              icon={<MdLock size={24} className="text-secondary" />}
              value={secretsOverview?.total_secrets}
              loading={loadingSecretsOverview}
              onClick={() => {}}
            />
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <StatCard
              title="Valid Secrets"
              icon={<MdLockOpen size={20} className="text-success" />}
              value={secretsOverview?.valid_secrets}
              loading={loadingSecretsOverview}
              onClick={() => handleSecretStatClick("secret-valid")}
              active={selectedSecretStat === "secret-valid"}
            />
            <StatCard
              title="Expired Secrets"
              icon={<MdLockClock size={20} className="text-error" />}
              value={secretsOverview?.expired_secrets}
              loading={loadingSecretsOverview}
              onClick={() => handleSecretStatClick("secret-expired")}
              active={selectedSecretStat === "secret-expired"}
            />
            <StatCard
              title={`Expiring in ${days} days`}
              icon={<IoWarning className="text-warning text-2xl" />}
              value={secretsExpiringSoon ?? undefined}
              loading={loadingSecretsExpiring}
              onClick={() => handleSecretStatClick("secret-expiring")}
              active={selectedSecretStat === "secret-expiring"}
            />
          </div>
        </div>
        {/* Table below grid */}
        <div className="flex-1 flex flex-col bg-base-100 rounded shadow-md border border-neutral/15 p-4 w-full">
          {selectedStat ? (
            <>
              <h2 className="text-2xl text-secondary-content font-bold mb-4">
                {stats.find((s) => s.key === selectedStat)?.title}
              </h2>
              {loadingList ? (
                <div className="flex justify-center items-center min-h-[70px]">
                  <span className="loading loading-dots loading-xl"></span>
                </div>
              ) : certificates.length === 0 ? (
                <p className="text-center">No certificates found.</p>
              ) : (
                <CertificateTable certificates={certificates} />
              )}
            </>
          ) : selectedSecretStat ? (
            <>
              <h2 className="text-2xl text-secondary-content font-bold mb-4">
                {selectedSecretStat === "secret-valid" && "Valid Secrets"}
                {selectedSecretStat === "secret-expired" && "Expired Secrets"}
                {selectedSecretStat === "secret-expiring" && `Secrets Expiring in ${days} days`}
              </h2>
              {loadingSecretsList ? (
                <div className="flex justify-center items-center min-h-[70px]">
                  <span className="loading loading-dots loading-xl"></span>
                </div>
              ) : secrets.length === 0 ? (
                <p className="text-center">No secrets found.</p>
              ) : (
                <SecretTable secrets={secrets} />
              )}
            </>
          ) : (
            <>
              <h2 className="text-2xl text-secondary-content font-bold mb-4">
                Top 20 Certificates by Nearest Expiry
              </h2>
              {loadingTopExpiry ? (
                <div className="flex justify-center items-center min-h-[70px]">
                  <span className="loading loading-dots loading-xl"></span>
                </div>
              ) : topExpiry.length === 0 ? (
                <p className="text-center">No certificates found.</p>
              ) : (
                <CertificateTable certificates={topExpiry} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value?: number;
  loading: boolean;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  loading,
  icon,
  onClick,
  active,
}) => (
  <div
    onClick={onClick}
    className={`flex flex-col border border-neutral/15 rounded p-4 bg-base-100 shadow cursor-pointer transition-all duration-200 hover:bg-accent/5 ${
      active ? "ring-2 ring-accent/50" : ""
    }`}
  >
    <div className="flex gap-2 items-center mb-3">
      <span className="text-xl">{icon}</span>
      <span className="text-lg font-semibold text-secondary-content">
        {title}
      </span>
    </div>
    <span className="text-3xl font-bold">{loading ? "..." : value}</span>
  </div>
);

interface CertificateTableProps {
  certificates: Certificate[];
  dateFormat?: string;
}

const CertificateTable: React.FC<CertificateTableProps> = ({
  certificates = [],
  dateFormat = "DD MMM YYYY",
}) => {
  const navigate = useNavigate();

  const handleRowClick = (cert: Certificate) => {
    navigate("/certificates", { state: { selectedCertId: cert.id } });
  };
  return (
    <div className="overflow-x-auto max-h-[calc(100vh-620px)] overflow-y-auto">
      <table className="table table-pin-rows">
        <thead className="">
          <tr>
            <th>Name</th>
            <th>Subject</th>
            <th className="text-end">Expires On</th>
          </tr>
        </thead>
        <tbody>
          {certificates.map((cert) => (
            <tr
              key={cert.id}
              className="cursor-pointer hover:bg-primary/10"
              onClick={() => handleRowClick(cert)}
            >
              <td className="truncate">{cert.name}</td>
              <td className="truncate">{cert.subject}</td>
              <td className="truncate text-end">
                {dayjs(cert.not_after).isValid()
                  ? dayjs(cert.not_after).format(dateFormat)
                  : cert.not_after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface SecretTableProps {
  secrets: Secret[];
  dateFormat?: string;
}

const SecretTable: React.FC<SecretTableProps> = ({
  secrets = [],
  dateFormat = "DD MMM YYYY",
}) => {
  const navigate = useNavigate();

  const handleRowClick = (secret: Secret) => {
    navigate("/secrets", { state: { selectedSecretId: secret.id } });
  };

  return (
    <div className="overflow-x-auto max-h-[calc(100vh-620px)] overflow-y-auto">
      <table className="table table-pin-rows">
        <thead>
          <tr>
            <th>Name</th>
            <th>Application</th>
            <th className="text-end">Expiry Date</th>
            <th className="text-end">Status</th>
          </tr>
        </thead>
        <tbody>
          {secrets.map((secret) => (
            <tr
              key={secret.id}
              className="cursor-pointer hover:bg-primary/10"
              onClick={() => handleRowClick(secret)}
            >
              <td className="truncate">{secret.name}</td>
              <td className="truncate">{secret.application}</td>
              <td className="truncate text-end">
                {secret.expiry_date && dayjs(secret.expiry_date).isValid()
                  ? dayjs(secret.expiry_date).format(dateFormat)
                  : secret.expiry_date || "No expiry"}
              </td>
              <td className="text-end">
                {secret.is_expired ? (
                  <span className="badge badge-error badge-sm">Expired</span>
                ) : secret.expiry_date ? (
                  <span className="badge badge-success badge-sm">Valid</span>
                ) : (
                  <span className="badge badge-ghost badge-sm">No Expiry</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DashboardStats;
