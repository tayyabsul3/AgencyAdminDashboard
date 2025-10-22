import React, { useState } from 'react';
import styles from './ImageCarousel.module.css';

const ImageCarousel = ({ images, descriptions }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? images.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    const isLastSlide = currentIndex === images.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  return (
    <div className={styles.carouselContainer}>
      <div className={styles.carouselImageWrapper}>
        <p className={styles.stepText}>Step {currentIndex + 1}: {descriptions[currentIndex]}</p>
        <img src={images[currentIndex]} alt={`Slide ${currentIndex + 1}`} className={styles.carouselImage} />
      </div>
      <div className={styles.carouselControls}>
        <button onClick={goToPrevious} className={styles.leftArrow}>&#10094;</button>
        <button onClick={goToNext} className={styles.rightArrow}>&#10095;</button>
      </div>
      <div className={styles.carouselDots}>
        {images.map((_, slideIndex) => (
          <div
            key={slideIndex}
            className={`${styles.dot} ${currentIndex === slideIndex ? styles.activeDot : ''}`}
            onClick={() => setCurrentIndex(slideIndex)}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default ImageCarousel;