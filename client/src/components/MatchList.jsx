// src/components/MatchList.jsx

import React, { useState, useEffect } from 'react';
import { List, Card, Button, Tag, Typography, Spin, Alert, Space, Select, message, Popconfirm, Avatar, Row, Col } from 'antd';
import { DeleteOutlined, UserOutlined, CrownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Option } = Select;
const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const formatMatchLength = (match) => {
    if (!match) return '';
    if (match.matchType === 'Team') {
        if (match.teamMatchSubType === 'Relay') { return `Relay to ${match.setPointTarget * match.numberOfSets}`; }
        return `${match.numberOfSets || 'N/A'} Sets`;
    }
    // Individual/Dual
    const bestOfMap = { 1: 'Best of 1', 2: 'Best of 3', 3: 'Best of 5' };
    return bestOfMap[match.setsToWin] || 'Best of 1';
};

const MatchList = ({ status = 'Upcoming', title = 'Matches', matchTypeFilter = null }) => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchMatches = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = { status };
                if (matchTypeFilter) { params.matchTypeFilter = matchTypeFilter; }
                const response = await axios.get(`${API_URL}/api/matches`, { params });
                setMatches(response.data || []);
            } catch (err) {
                setError(`Failed to load ${status} matches.`);
            } finally {
                setLoading(false);
            }
        };
        fetchMatches();
    }, [status, matchTypeFilter]);

    const handleNavigateToScoreboard = (match) => {
        if (!match?._id) return;
        const path = match.matchType === 'Team' ? '/team-match' : '/match';
        navigate(`${path}/${match._id}/score`);
    };

    const handleLengthChange = async (matchId, newBestOfValue) => {
        const setsToWinMap = { 1: 1, 3: 2, 5: 3 };
        const newSetsToWin = setsToWinMap[newBestOfValue];
        setUpdatingId(matchId);
        try {
            const response = await axios.put(`${API_URL}/api/matches/${matchId}/length`, { setsToWin: newSetsToWin });
            setMatches(current => current.map(m => (m._id === matchId ? response.data : m)));
            message.success('Match length updated!');
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to update length.');
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDeleteMatch = async (matchId) => {
        setUpdatingId(matchId);
        try {
            await axios.delete(`${API_URL}/api/matches/${matchId}`);
            setMatches(current => current.filter(m => m._id !== matchId));
            message.success('Match deleted!');
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to delete match.');
        } finally {
            setUpdatingId(null);
        }
    };

    if (loading && matches.length === 0) { return <Card title={title}><div style={{ textAlign: 'center', padding: 50 }}><Spin /></div></Card>; }
    if (error && matches.length === 0) { return <Card title={title}><Alert message="Error" description={error} type="error" showIcon /></Card>; }

    const renderAvatarDisplay = (players = []) => {
        if (!players || players.length === 0) {
            return <Avatar icon={<UserOutlined />} />;
        }
        if (players.length === 1) {
            const p = players[0];
            return <Avatar src={p?.photoUrl ? `${API_URL}${p.photoUrl}` : undefined}>{!p?.photoUrl && p?.name ? p.name.charAt(0).toUpperCase() : <UserOutlined />}</Avatar>;
        }
        return (
            <Avatar.Group max={{ count: 2 }}>
                {players.map(p => (
                    p ? <Avatar key={p._id} src={p.photoUrl ? `${API_URL}${p.photoUrl}` : undefined}>{!p.photoUrl && p.name ? p.name.charAt(0).toUpperCase() : <UserOutlined />}</Avatar> : null
                ))}
            </Avatar.Group>
        );
    };



    return (
        <Card title={<Title level={4}>{title}</Title>}>
            <List
                itemLayout="horizontal"
                dataSource={matches}
                loading={loading}
                locale={{ emptyText: `No ${status} matches found.` }}
                pagination={{ pageSize: 5, hideOnSinglePage: true }}
                renderItem={(match) => {
                    const isUpdating = updatingId === match._id;

                    let team1Players, team2Players, team1Name, team2Name, descriptionTags, team1Avatars, team2Avatars;

                    if (match.matchType === 'Team') {
                        team1Name = match.team1?.name || 'N/A';
                        team2Name = match.team2?.name || 'N/A';
                        team1Avatars = <Avatar size="large" src={match.team1?.logoUrl ? `${API_URL}${match.team1.logoUrl}` : undefined} icon={<UserOutlined />} />;
                        team2Avatars = <Avatar size="large" src={match.team2?.logoUrl ? `${API_URL}${match.team2.logoUrl}` : undefined} icon={<UserOutlined />} />;
                        descriptionTags = <><Tag color="purple">{match.matchType}{match.teamMatchSubType ? ` (${match.teamMatchSubType})` : ''}</Tag><Tag>{formatMatchLength(match)}</Tag></>;

                    } else { // Individual or Dual
                        team1Players = match.matchType === 'Individual' ? [match.player1] : [match.player1, match.player2];
                        team2Players = match.matchType === 'Individual' ? [match.player2] : [match.player3, match.player4];

                        team1Players = team1Players.filter(Boolean);
                        team2Players = team2Players.filter(Boolean);

                        team1Name = team1Players.map(p => p?.name).join(' & ') || 'N/A';
                        team2Name = team2Players.map(p => p?.name).join(' & ') || 'N/A';
                        
                        team1Avatars = renderAvatarDisplay(team1Players);
                        team2Avatars = renderAvatarDisplay(team2Players);
                        descriptionTags = <>{match.category && <Tag>{match.category}</Tag>}<Tag color="purple">{match.matchType}</Tag><Tag>{formatMatchLength(match)}</Tag></>;
                    }

                    if (status === 'Finished') {
                        let winnerName = 'N/A'; let finalScore = 'N/A';
                        if (match.winner !== undefined && match.winner !== null) {
                            if (match.matchType === 'Team') {
                                winnerName = match.winner === 1 ? match.team1?.name : match.team2?.name;
                                if (match.teamMatchSubType === 'Set') { finalScore = `${match.score?.currentSetScore?.team1 ?? 0} - ${match.score?.currentSetScore?.team2 ?? 0}`; }
                                else { finalScore = `${match.score?.overallScore?.team1 ?? 0} - ${match.score?.overallScore?.team2 ?? 0}`; }
                            } else {
                                if (match.matchType === 'Individual') {
                                    winnerName = match.winner?.toString() === match.player1?._id?.toString() ? match.player1?.name : match.player2?.name;
                                } else { 
                                    winnerName = match.winner === 1 ? team1Name : team2Name;
                                }
                                finalScore = (match.score?.sets || []).map(s => `${s[0]}-${s[1]}`).join(', ');
                            }
                        }
                        descriptionTags = <> <Tag icon={<CrownOutlined />} color="gold">Winner: {winnerName || 'N/A'}</Tag> <Tag>Final Score: {finalScore}</Tag> </>;
                    }

                    return (
                        <List.Item
                            key={match._id}
                            actions={
                                status === 'Upcoming' ? [
                                    (match.matchType !== 'Team' && 
                                        <Select key="length" value={match.setsToWin} style={{ width: 120 }} onChange={(val) => handleLengthChange(match._id, val)} disabled={isUpdating}>
                                            <Option value={1}>Best of 1</Option><Option value={2}>Best of 3</Option><Option value={3}>Best of 5</Option>
                                        </Select>
                                    ),
                                    <Button key="start" type="primary" onClick={() => handleNavigateToScoreboard(match)} disabled={isUpdating}>Start & Score</Button>,
                                    <Popconfirm key="delete" title="Delete?" onConfirm={() => handleDeleteMatch(match._id)} okButtonProps={{ loading: isUpdating }}><Button danger type="text" icon={<DeleteOutlined />} disabled={isUpdating} /></Popconfirm>
                                ] : status === 'Live' ? [
                                    <Button key="view" onClick={() => handleNavigateToScoreboard(match)}>View Scoreboard</Button>
                                ] : []
                            }
                        >
                            <List.Item.Meta
                                title={
                                    <Row align="middle" gutter={16}>
                                        <Col xs={24} sm={8} md={9} style={{ textAlign: 'right' }}><Text strong>{team1Name}</Text></Col>
                                        <Col xs={24} sm={8} md={6} style={{ textAlign: 'center' }}>
                                            <Space align="center">
                                                {team1Avatars}
                                                <Text>vs</Text>
                                                {team2Avatars}
                                            </Space>
                                        </Col>
                                        <Col xs={24} sm={8} md={9} style={{ textAlign: 'left' }}><Text strong>{team2Name}</Text></Col>
                                    </Row>
                                }
                                description={<div style={{ paddingLeft: '8px', marginTop: '4px' }}><Space>{descriptionTags}</Space></div>}
                            />
                        </List.Item>
                    );
                }}
            />
        </Card>
    );
};

export default MatchList;