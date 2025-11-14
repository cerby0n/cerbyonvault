import { useEffect, useState } from "react";
import useAxios from "../axios/useAxios";
import { useToast } from "../components/ToastProvider";
import { FiExternalLink } from "react-icons/fi";
import { Globe } from "lucide-react";

type Certificate = {
  id: number;
  name: string;
};

type Website = {
  id: number;
  url: string;
  domain: string;
  certificate: Certificate | null;
};

export default function WebsitesList() {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCertId, setSelectedCertId] = useState<number | "">("");
  const axiosInstance = useAxios();
  const { notify } = useToast();

  const fetchWebistes = async () => {
    try {
      const res = await axiosInstance.get(`/websites/`);
      setWebsites(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      notify("Failed to fetch websites","error");
    }
  };

  const certificates = Array.from(
    new Map(
      websites
        .filter((w) => w.certificate)
        .map((w) => [w.certificate!.id, w.certificate!])
    ).values()
  );

  const filteredWebsites = websites.filter((site) => {
    const matchesSearch =
      site.domain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.url?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCert =
      selectedCertId === "" ||
      (site.certificate && site.certificate.id === selectedCertId);
    return matchesSearch && matchesCert;
  });

  useEffect(() => {
    fetchWebistes();
  }, []);

  return (
    <div className="w-full flex">
      <div className="flex flex-col w-full space-y-2">
        <div className="p-6 bg-base-100 rounded top-0 items-center">
          <h1 className="text-4xl font-bold text-secondary-content flex items-center gap-3">
            <Globe size={36} />
            Websites
          </h1>
        </div>
        <div className="bg-base-100 rounded h-full p-4">
          <div className="flex gap-4 mb-4">
            {/* Search Input */}
            <input
              type="text"
              className="input input-bordered"
              placeholder="Search by domain"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {/* Certificate Dropdown */}
            <select
              className="select select-bordered"
              value={selectedCertId}
              onChange={(e) =>
                setSelectedCertId(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            >
              <option value="">All Certificates</option>
              {certificates.map((cert) => (
                <option key={cert.id} value={cert.id}>
                  {cert.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full overflow-x-auto max-h-[calc(100vh-225px)] overflow-y-auto">
            <table className="table w-full rounded table-fixed shadow">
              <thead>
                <tr className="">
                  <th className="py-2 px-4 w-1/4">Domain</th>
                  <th className="py-2 px-4 w-1/3">Certificate</th>
                  <th className="py-2 px-4 w-1/6 text-center">Visit</th>
                </tr>
              </thead>
              <tbody>
                {filteredWebsites.map((site) => (
                  <tr key={site.id} className="border-t">
                    <td className="py-2 px-4">{site.domain}</td>
                    <td className="py-2 px-4">
                      {site.certificate
                        ? site.certificate.name
                        : "No Certificate"}
                    </td>
                    <td className="py-2 px-4 text-center">
                      <a
                        href={site.url}
                        className="font-bold rounded inline-flex items-center justify-center"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <FiExternalLink size={20} className="text-primary"/>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
