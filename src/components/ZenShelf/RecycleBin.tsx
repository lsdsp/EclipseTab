import React from 'react';
import ReactDOM from 'react-dom';
import styles from './ZenShelf.module.css';
import TrashCanIcon from '../../assets/icons/TrashCan.svg';

interface RecycleBinProps {
    isVisible: boolean;
}

export const RecycleBin: React.FC<RecycleBinProps> = ({ isVisible }) => {
    return ReactDOM.createPortal(
        <div
            id="sticker-recycle-bin"
            className={`${styles.recycleBin} ${isVisible ? styles.visible : ''}`}
        >
            <img src={TrashCanIcon} alt="Trash Can" className={styles.recycleIcon} />
        </div>,
        document.body
    );
};
