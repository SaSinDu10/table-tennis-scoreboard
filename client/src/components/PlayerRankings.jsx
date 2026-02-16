// src/components/PlayerRankings.jsx
import React, { useState, useEffect } from 'react';
import { Table, Card, Spin, Alert, Typography, Avatar, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PlayerRankings = () => {
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
        const totalPlayers = rankings.length;

        if (rank <= 5) {
            return 'rank-top-5'; // Green
        }
        if (rank > totalPlayers - 5) {
            return 'rank-bottom-5'; // Red
        }
        return 'rank-middle'; // Yellow
    };

    if (error) {
        return <Alert message="Error" description={error} type="error" showIcon />;
    }

    return (
        <>
        <style>{`
                .rank-top-5 {
                    background-color: #cdf7e3 !important; /* Light green */
                }
                .rank-bottom-5 {
                    background-color: #f8bbc0 !important; /* Light red */
                }
                .rank-middle {
                    background-color: #f3f8cd !important; /* Light yellow */
                }
                /* Optional: Add hover effect */
                .ant-table-tbody > tr:hover > td {
                    background-color: #e6f4ff !important;
                }
            `}</style>
            <Card title={<Title level={1}>Player Rankings</Title>} style={{ textAlign: 'center'}}>
                <Spin spinning={loading} tip="Loading Rankings...">
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