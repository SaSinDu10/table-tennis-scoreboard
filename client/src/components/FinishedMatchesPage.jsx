// src/components/FinishedMatchesPage.jsx
import React from 'react';
import { Typography, Space } from 'antd';
import MatchList from './MatchList';

const { Title } = Typography;

const FinishedMatchesPage = () => {
    return (
        <Space direction="vertical" size="large" style={{ display: 'flex' }}>

            <Title level={2} style={{ textAlign: 'center', marginBottom: '24px' }}>
                Match History
            </Title>

            <MatchList
                status="Finished"
                title="Finished Individual Matches"
                matchTypeFilter="Individual"
            />

            <MatchList
                status="Finished"
                title="Finished Dual Matches"
                matchTypeFilter="Dual"
            />

            <MatchList
                status="Finished"
                title="Finished Team Matches"
                matchTypeFilter="Team"
            />

        </Space>
    );
};

export default FinishedMatchesPage;