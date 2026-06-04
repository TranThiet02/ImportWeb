const ConfidenceBadge = ({ confidence, autoSaved }) => {
    if (!confidence) return <span>—</span>

    let color, label
    if (confidence >= 90) {
        color = '#48bb78'
        label = `${confidence}% Rất cao`
    } else if (confidence >= 80) {
        color = '#38a169'
        label = `${confidence}% Cao`
    } else if (confidence >= 70) {
        color = '#ecc94b'
        label = `${confidence}% Trung bình`
    } else {
        color = '#ed8936'
        label = `${confidence}% Thấp`
    }

    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{
                background: color,
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap'
            }}>
                {label}
            </span>
            {autoSaved && (
                <span style={{
                    background: '#f0fff4',
                    color: '#276749',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
                }}>
                    Tự động lưu
                </span>
            )}
        </div>
    )
}

export default ConfidenceBadge