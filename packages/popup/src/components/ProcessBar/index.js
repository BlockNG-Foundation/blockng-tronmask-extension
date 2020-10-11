import React from 'react';
import './ProcessBar.scss';

const ProcessBar = props => {
    const {
        percentage,
        len = 45
    } = props;
    const index = Math.floor(percentage*len);

    return (
        <div className="processBar" >
            {
                Array.from({length:len},(v,i)=>i).map(v=>(v<index?<div className="bar green"></div>:<div className="bar grey"></div>))
            }
        </div>
    );
};

export default ProcessBar;
