import { useEffect, useRef, useState } from "react";
import { Certificate } from "../types";
import { useCertService } from "../utils/useCertService";
import { useFileUpload } from "../hooks/useFileUpload";
import { useSelection } from "../hooks/useSelection";
import CertImportModal from "./modals/CertImportModal";
import { buildCertificateTree } from "../utils/TreeStruct";
import PasswordModal from "./modals/PasswordModal";
import ListHeader from "./items/ListHeader";
import TreeItem from "./items/TreeItem";
import { useItemFetch } from "../hooks/useItemFetch";
import SidePanelCert from "./SidePanelCert";
import CertificateContextMenu from "./CertificateContextMenu";
import ExportModal from "./modals/ExportModal";
import { useExportActions } from "../hooks/useExportActions";
import { useLocation, useNavigate } from "react-router-dom";

export default function CertificateList() {
  const location = useLocation();
  const navigate = useNavigate();
  const { deleteCertificates } = useCertService();
  const { selectedItems, handleSelect, handleOpenDetails, clearSelection } =
    useSelection<Certificate>();
  const [searchTerm, setSearchTerm] = useState("");
  const [minWidth, maxWidth, defaultWidth] = [400, 1000, 400];
  const [width, setWidth] = useState(defaultWidth);
  const isResized = useRef(false);
  const [validFilter, setValidFilter] = useState<"all" | "valid" | "not_valid">(
    "all"
  );
  const { fetchCerts, certs } = useItemFetch();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCertName, setExportCertName] = useState<string>("");
  const [exportCertId, setExportCertId] = useState<number | null>(null);
  const { buildExportUrl, downloadFile } = useExportActions();
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    certId: 0,
    hasPrivateKey: false,
  });
  const {
    showPasswordModal,
    parsedData,
    setPassword,
    password,
    handlePasswordSubmit,
    closeModal,
    loading,
    error
  } = useFileUpload(() => fetchCerts());

  const exportCert = certificates.find(c => c.id === exportCertId);

  useEffect(() => {
    window.addEventListener("mousemove", (e) => {
      if (!isResized.current) {
        return;
      }

      setWidth((previousWidth) => {
        const newWidth = previousWidth - e.movementX / 1;

        const isWidthInRange = newWidth >= minWidth && newWidth <= maxWidth;

        return isWidthInRange ? newWidth : previousWidth;
      });
    });

    window.addEventListener("mouseup", () => {
      isResized.current = false;
    });
  }, []);

  useEffect(() => {
    fetchCerts();
  }, []);

  useEffect(() => {
    setCertificates(certs);
  }, [certs]);

  useEffect(() => {
    if (
      location.state &&
      location.state.selectedCertId &&
      certificates.length > 0
    ) {
      const certToSelect = certificates.find(
        (cert) => cert.id === location.state.selectedCertId
      );
      if (certToSelect) {
        handleSelect(
          certToSelect,
          { shiftKey: false, ctrlKey: false, metaKey: false } as any,
          certificates
        );
        navigate("/certificates", { replace: true, state: {} });
      }
    }
  }, [location.state, certificates, navigate]);

  const handleDeleteSelected = async () => {
    try {
      const selectedIds = selectedItems.map((item) => item.id);
      await deleteCertificates(selectedIds);
      clearSelection();
      fetchCerts();
    } catch (err) {
      alert("Failed to delete certificates.");
    }
  };

  const handleRightClick = (e: React.MouseEvent, cert: Certificate) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.pageX,
      y: e.pageY,
      certId: cert.id,
      hasPrivateKey: cert.has_private_key,
    });
    setExportCertName(cert.name);
  };

  function filterCertificates(certs: Certificate[]) {
    return certs.filter((cert) => {
      if (validFilter === "not_valid" && !cert.is_expired) return false;
      if (validFilter === "valid" && cert.is_expired) return false;
      return true;
    });
  }

  const fullTree = buildCertificateTree(certs);

  return (
    <div className="w-full flex h-full">
      <div className="flex flex-col w-full space-y-2">
        <ListHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedItems={selectedItems}
          handleDeleteSelected={handleDeleteSelected}
          fetchType={fetchCerts}
          clearSelection={clearSelection}
        />

        <div className="flex h-full bg-base-100 rounded">
          {/* Password Modal for PFX Files */}
          {showPasswordModal && (
            <PasswordModal
              password={password}
              setPassword={setPassword}
              handlePasswordSubmit={handlePasswordSubmit}
              closeModal={closeModal}
              loading={loading}
              error={error}
            />
          )}

          {/* Certificate Tree List */}
          <div className="ml-4 mt-4 space-y-2 flex-1 min-w-0">
            {/* Filter Bar (not scrollable) */}
            <div className="flex gap-2 mb-4">
              {[
                { label: "All", value: "all" },
                { label: "Valid", value: "valid" },
                { label: "Expired", value: "not_valid" },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  className={`px-4 rounded-full text-sm font-medium transition
          ${
            validFilter === value
              ? "bg-primary text-primary-content "
              : "bg-base-200/50 text-secondary-content hover:bg-primary hover:text-primary-content"
          }`}
                  onClick={() => setValidFilter(value as any)}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Scrollable Certificate List */}
            <div className="flex-1 min-h-0 max-h-[calc(100vh-200px)] overflow-y-auto">
              <ul className="space-y-2">
                {searchTerm === ""
                  ? filterCertificates(fullTree).map((cert) => (
                      <TreeItem
                        key={cert.id}
                        cert={cert}
                        selectedIds={selectedItems.map((item) => item.id)}
                        onClick={(e, cert) => handleSelect(cert, e, certificates)}
                        onDoubleClick={(cert) => handleOpenDetails(cert)}
                        onChildSelect={(e, cert) =>
                          handleSelect(cert, e, certificates)
                        }
                        onChildDoubleClick={() => handleOpenDetails(cert)}
                        onContextMenu={handleRightClick}
                        isFlat={false}
                      />
                    ))
                  : filterCertificates(certs)
                      .filter((cert) =>
                        cert.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((cert) => (
                        <TreeItem
                          key={cert.id}
                          cert={cert}
                          selectedIds={selectedItems.map((item) => item.id)}
                          onClick={(e, cert) => handleSelect(cert, e, certificates)}
                          onDoubleClick={(cert) => handleOpenDetails(cert)}
                          onChildSelect={(e, cert) =>
                            handleSelect(cert, e, certificates)
                          }
                          onChildDoubleClick={() => handleOpenDetails(cert)}
                          onContextMenu={handleRightClick}
                          isFlat={true}
                        />
                      ))}
              </ul>
            </div>
          </div>
          {contextMenu.visible && (
            <CertificateContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              visible={contextMenu.visible}
              onClose={() => setContextMenu((m) => ({ ...m, visible: false }))}
              certId={contextMenu.certId}
              certName={exportCertName}
              hasPrivateKey={contextMenu.hasPrivateKey} 
              onExportClick={(certId, certName) => {
                setContextMenu((m) => ({ ...m, visible: false }));
                setExportCertId(certId);
                setExportCertName(certName);
                setShowExportModal(true);
              }}
            />
          )}

          {selectedItems.length === 1 && (
            <>
              <div
                className="w-1 my-5 cursor-col-resize bg-neutral opacity-0 hover:opacity-25"
                onMouseDown={() => {
                  isResized.current = true;
                }}
              />
              <div style={{ width: `${width / 16}rem` }} className="flex h-full">
                <div className="rounded-xl shadow-xl bg-base-100 border-2 border-base-100 flex-grow opacity-100 overflow-hidden">
                  <SidePanelCert
                    isOpen={selectedItems.length === 1}
                    onClose={() => clearSelection()}
                    data={{ cert: selectedItems[0] }}
                    onUpdated={fetchCerts}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        {showExportModal && exportCertId !== null && (
          <ExportModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            onDownload={(variant, format, password) => {
              const url = buildExportUrl(
                exportCertId,
                variant,
                format,
                password || ""
              );
              downloadFile(url, exportCertName, format);
            }}
            hasPrivateKey={!!exportCert?.has_private_key}
            certName={exportCertName}
          />
        )}
        {/* CertImportModal for Successful Upload */}
        {parsedData && (
          <CertImportModal
            session_key={parsedData.session_key}
            certificates={parsedData.certificates}
            private_key={parsedData.private_key}
            onSubmit={async () => {
              closeModal();
              fetchCerts();
            }}
            onCancel={closeModal}
          />
        )}
      </div>
    </div>
  );
}
