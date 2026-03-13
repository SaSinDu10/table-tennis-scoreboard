// src/components/PlayerRankings.jsx
import React, { useState, useEffect } from 'react';
import { Table, Card, Spin, Alert, Typography, Avatar, Space, theme } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PlayerRankings = () => {
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { token } = theme.useToken();

    useEffect(() => {
        const fetchRankings = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.get(`${API_URL}/api/stats/rankings`);
                setRankings(response.data || []);
            } catch (err) {
                console.error("Error fetching rankings:", err);
                setError("Failed to load player rankings.");
            } finally {
                setLoading(false);
            }
        };
        fetchRankings();
    }, []);

    // Define table columns
    const columns = [
        {
            title: 'Rank',
            key: 'rank',
            render: (text, record, index) => index + 1,
            width: 80,
            align: 'center',
        },
        {
            title: 'Player',
            key: 'player',
            render: (text, record) => (
                <Space>
                    <Avatar
                        size={48}
                        src={record.photoUrl ? `${API_URL}${record.photoUrl}` : undefined}
                        icon={!record.photoUrl ? <UserOutlined /> : null}
                    >
                        {!record.photoUrl ? record.name?.charAt(0)?.toUpperCase() : null}
                    </Avatar>
                    <span style={{ fontSize: '1.4em', fontWeight: 500 }}>
                        {record.name}
                        <span style={{ display: 'block', fontSize: '0.85em', fontWeight: 400, color: '#888' }}>
                            ({record.category})
                        </span>
                    </span>
                </Space>
            ),
        },
        {
            title: 'Total Points',
            dataIndex: 'points',
            key: 'points',
            sorter: (a, b) => a.points - b.points,
            defaultSortOrder: 'descend',
            width: 150,
            align: 'center',
        },
        {
            title: 'Wins',
            dataIndex: 'wins',
            key: 'wins',
            sorter: (a, b) => a.wins - b.wins,
            width: 100,
            align: 'center',
        },
    ];

    // --- FUNCTION FOR CONDITIONAL ROW STYLING ---
    const getRowClassName = (record, index) => {
        const rank = index + 1;
        if (rank <= 5) return 'rank-top-5';
        if (rank > rankings.length - 5 && rankings.length > 10) return 'rank-bottom-5';
        return 'rank-middle';
    };

    if (error) {
        return <Alert message="Error" description={error} type="error" showIcon />;
    }

    return (
        <>
            <style>{`
                .rank-top-5 td {
                    background-color: ${token.colorSuccessBgHover} !important;
                }
                .rank-middle td {
                    background-color: ${token.colorWarningBgHover} !important;
                }
                .rank-bottom-5 td {
                    background-color: ${token.colorErrorBgHover} !important;
                }
            `}</style>

            <Card
                variant={false}
                Style={{ padding: 0 }}
            >
                <Title level={2} style={{
                    textAlign: 'center',
                    marginBottom: '24px',
                    color: token.colorText
                }}>
                    Player Rankings
                </Title>

                <Spin spinning={loading}>
                    <Table
                        columns={columns}
                        dataSource={rankings}
                        loading={loading}
                        rowKey="_id"
                        pagination={{ pageSize: 50 }}
                        rowClassName={getRowClassName}
                    />
                </Spin>
            </Card>
        </>
    );
};


export default PlayerRankings;