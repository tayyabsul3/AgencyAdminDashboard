import CloseIcon from "./CloseIcon";
import ImageCropper from "../Media/ImageCropper";

const Modal = ({ data, closeModal }) => {
  return (
    <div
      className="relative z-10"
      aria-labelledby="crop-image-dialog"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 transition-all backdrop-blur-sm"></div>
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto ">
        <div className="flex  justify-center px-2 py-12 text-center  ">
          <div className="relative  rounded-2xl bg-gray-700  text-white text-left  shadow-2xl transition-all">
            <div className="px-5 py-4 space-y-5 font-medium text-center ">
              <h1>Select The area to crop from the image </h1>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Modal;