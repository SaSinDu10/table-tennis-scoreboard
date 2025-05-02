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
    }, []); // Fetch only on component mount

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
                        src={record.photoUrl ? `${API_URL}${record.photoUrl}` : undefined}
                        icon={!record.photoUrl ? <UserOutlined /> : null}
                    >
                        {!record.photoUrl ? record.name?.charAt(0)?.toUpperCase() : null}
                    </Avatar>
                    <span>{record.name} ({record.category})</span>
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
            align: 'right',
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

    if (error) {
        return <Alert message="Error" description={error} type="error" showIcon />;
    }

    return (
        <Card title={<Title level={4}>Player Rankings</Title>}>
            <Spin spinning={loading} tip="Loading Rankings...">
                <Table
                    columns={columns}
                    dataSource={rankings}
                    loading={loading}
                    rowKey="_id"
                    pagination={{ pageSize: 10 }}
                />
            </Spin>
        </Card>
    );
};

export default PlayerRankings;