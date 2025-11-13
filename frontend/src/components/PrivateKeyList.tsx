import { useEffect, useRef, useState } from "react";
import { useCertService } from "../utils/useCertService";
import { useFileUpload } from "../hooks/useFileUpload";
import CertImportModal from "./modals/CertImportModal";
import PasswordModal from "./modals/PasswordModal";
import PrivateKeyNode from "./items/PrivateKeyNode";
import ListHeader from "./items/ListHeader";
import { useItemFetch } from "../hooks/useItemFetch";
import { usePrivateKeySelection } from "../hooks/usePrivateKeySelection";
import SidePanelKey from "./SidePanelKey";

export default function PrivateKeyList() {
  const { deletePrivateKeys } = useCertService();
  const [minWidth, maxWidth, defaultWidth] = [400, 1000, 400];
  const [width, setWidth] = useState(defaultWidth);
  const isResized = useRef(false);
  const [keySizeFilter, setKeySizeFilter] = useState<string>("All");
  const { selectedItems, handleSelect, clearSelection, handleOpenDetails } =
    usePrivateKeySelection();
  const [searchTerm, setSearchTerm] = useState("");
  const { fetchKeys, keys } = useItemFetch();
  const {
    showPasswordModal,
    parsedData,
    setPassword,
    password,
    handlePasswordSubmit,
    closeModal,
    loading,
    error,
  } = useFileUpload(() => fetchKeys());

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
    fetchKeys();
  }, []);

  const handleDeleteSelected = async () => {
    try {
      const selectedIds = selectedItems.map((item) => item.id);
      await deletePrivateKeys(selectedIds);
      clearSelection();
      fetchKeys();
    } catch (err) {
      alert("Failed to delete private keys.");
    }
  };

  const filteredKeys = keys
    .filter((key) => key.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((key) =>
      keySizeFilter === "All" ? true : String(key.keysize) === keySizeFilter
    );

  const keySizes = Array.from(
    new Set(keys.map((k) => k.keysize).filter(Boolean))
  ).sort((a, b) => Number(a) - Number(b));

  const keySizeOptions = ['All', ...keySizes.map(String)];

  return (
    <div className="w-full flex">
      <div className="flex flex-col w-full space-y-2 ">
        <ListHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedItems={selectedItems}
          handleDeleteSelected={handleDeleteSelected}
          fetchType={fetchKeys}
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

          {/* Private Key List */}
          <div className="ml-4 mt-4 space-y-2 flex-1 min-w-0">
            <div className="flex gap-2 mb-4">
              {keySizeOptions.map((size) => (
                <button
                  key={size}
                  className={`px-4 rounded-full text-sm font-medium transition
        ${
          keySizeFilter === size
            ? "bg-primary text-primary-content"
            : "bg-base-200/50 text-secondary-content hover:bg-primary hover:text-primary-content"
        }`}
                  onClick={() => setKeySizeFilter(size)}
                >
                  {size}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 max-h-[calc(100vh-200px)] overflow-y-auto">
              <ul>
                {filteredKeys.map((key) => (
                  <PrivateKeyNode
                    key={key.id}
                    privateKey={key}
                    selectedIds={selectedItems.map((item) => item.id)}
                    onClick={(e) => handleSelect(key, e, keys)}
                    onDoubleClick={() => handleOpenDetails(key)}
                  />
                ))}
              </ul>
            </div>
          </div>

          {selectedItems.length === 1 && (
            <>
              <div
                className="w-1 my-5 cursor-col-resize bg-neutral opacity-0 hover:opacity-25"
                onMouseDown={() => {
                  isResized.current = true;
                }}
              />
              <div style={{ width: `${width / 16}rem` }} className="flex ">
                <div className="p-4 rounded-xl shadow-xl bg-base-100 border-2 border-base-100 flex-grow opacity-100">
                  <SidePanelKey
                    isOpen={selectedItems.length === 1}
                    onClose={() => clearSelection()}
                    data={{ privateKey: selectedItems[0] }}
                    onUpdated={fetchKeys}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* CertImportModal for Successful Upload */}
        {parsedData && (
          <CertImportModal
            session_key={parsedData.session_key}
            certificates={parsedData.certificates}
            private_key={parsedData.private_key}
            onSubmit={async () => {
              closeModal();
              fetchKeys();
            }}
            onCancel={closeModal}
          />
        )}
      </div>
    </div>
  );
}
