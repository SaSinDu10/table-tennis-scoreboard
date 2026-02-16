import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Typography, Spin, Alert, Space, message } from 'antd';
import axios from 'axios';
import { Routes, Route, useNavigate, useLocation, useMatch } from 'react-router-dom';
import PlayerForm from './components/PlayerForm';
import PlayerList from './components/PlayerList';
import MatchSetupForm from './components/MatchSetupForm';
import TeamMatchesLanding from './components/TeamMatchesLanding';
import TeamSetMatchSetup from './components/TeamSetMatchSetup';
import TeamRelayMatchSetup from './components/TeamRelayMatchSetup';
import TeamForm from './components/TeamForm';
import TeamList from './components/TeamList';
import MatchList from './components/MatchList';
import Scoreboard from './components/Scoreboard';
import TeamScoreboard from './components/TeamScoreboard';
import PlayerRankings from './components/PlayerRankings';
import 'antd/dist/reset.css';

import { UserOutlined, UnorderedListOutlined, TrophyOutlined, TeamOutlined, UsergroupAddOutlined } from '@ant-design/icons';

const { Header, Content, Footer, Sider } = Layout;
const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
    const [players, setPlayers] = useState([]);
    const [loadingPlayers, setLoadingPlayers] = useState(true);
    const [errorPlayers, setErrorPlayers] = useState(null);
    const [matchListVersion, setMatchListVersion] = useState(0);
    // ------------------------------------------------

    const [teams, setTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(true);
    const [errorTeams, setErrorTeams] = useState(null);

    // React Router hooks
    const navigate = useNavigate();
    const location = useLocation();
    const isScoreboardRoute = useMatch("/match/:id/score");
    const onStandardScoreboard = useMatch("/match/:id/score");
    const onTeamScoreboard = useMatch("/team-match/:id/score");
    const hideSider = onStandardScoreboard || onTeamScoreboard;

    // Function to fetch players - memoized with useCallback
    const fetchPlayers = useCallback(async () => {
        console.log("Fetching players...");
        setLoadingPlayers(true);
        setErrorPlayers(null);
        try {
            const response = await axios.get(`${API_URL}/api/players`);
            setPlayers(response.data || []);
            console.log("Players fetched successfully:", response.data?.length);
        } catch (err) {
            console.error("Error fetching players:", err.response?.data || err.message || err);
            const errorMsg = err.response?.data?.message || 'Failed to load players.';
            setErrorPlayers(errorMsg);
            setPlayers([]);
            message.error(errorMsg);
        } finally {
            console.log("Setting loadingPlayers to false.");
            setLoadingPlayers(false);
        }
    }, []);

    useEffect(() => {
        if (location.pathname === '/') {
            fetchPlayers();
        }
    }, [fetchPlayers, location.pathname]);

    // --- Fetch Teams ---
    const fetchTeams = useCallback(async () => {
        console.log("Fetching teams...");
        setLoadingTeams(true);
        setErrorTeams(null);
        try {
            const response = await axios.get(`${API_URL}/api/teams`);
            setTeams(response.data || []);
            console.log("Teams fetched successfully:", response.data?.length);
        } catch (err) {
            console.error("Error fetching teams:", err.response?.data || err.message || err);
            const errorMsg = err.response?.data?.message || 'Failed to load teams.';
            setErrorTeams(errorMsg);
            setTeams([]);
            message.error(errorMsg);
        } finally {
            console.log("Setting loadingTeams to false.");
            setLoadingTeams(false);
        }
    }, []);
    useEffect(() => { if (location.pathname === '/teams') fetchTeams(); }, [fetchTeams, location.pathname]);
    // -----------------

    const handlePlayerAdded = (newPlayer) => {
        setPlayers(prevPlayers =>
            [...prevPlayers, newPlayer].sort((a, b) => a.name.localeCompare(b.name))
        );
        console.log("App detected player added:", newPlayer);
    };

    // --- UPDATED Callback for MatchSetupForm ---
    const handleMatchCreated = (newMatch) => {
        console.log("App detected match created:", newMatch);
        message.success(`Match created successfully!`);
        // --- Increment version state to trigger MatchList remount/refresh ---
        setMatchListVersion(prevVersion => prevVersion + 1);
    };

    const handleTeamCreated = (newTeam) => { // Add to list and re-sort
        setTeams(prevTeams => [...prevTeams, newTeam].sort((a, b) => a.name.localeCompare(b.name)));
        console.log("App detected team created:", newTeam);
    };

    const handleTeamMatchCreated = (newMatch) => { // Specific handler for team matches
        console.log("App detected TEAM match created:", newMatch);
        message.success(`Team Match created successfully!`);
        setMatchListVersion(prevVersion => prevVersion + 1); // Refresh lists on the team page too
    };

    // Determine selected menu key based on route
    const getSelectedKey = () => {
        const path = location.pathname;
        if (hideSider) return null;
        if (path === '/team-matches') return '4';
        if (path === '/rankings') return '5';
        if (path === '/teams') return '2';
        if (path === '/setup-match') return '3';
        if (path === '/') return '1';
        return '1';
    };
    const menuItems = [
        { key: '1', label: 'Players', icon: <UserOutlined /> },
        { key: '2', label: 'Teams', icon: <UsergroupAddOutlined /> },
        { key: '3', label: 'Ind/Dual Matches', icon: <UnorderedListOutlined /> },
        { key: '4', label: 'Team Matches', icon: <TeamOutlined /> },
        { key: '5', label: 'Rankings', icon: <TrophyOutlined /> },
    ];

    return (
        <Layout style={{ minHeight: '100vh' }}>
            {!isScoreboardRoute && (
                <Sider breakpoint="lg" collapsedWidth="0">
                    <div style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', color: 'white', lineHeight: '32px', borderRadius: '4px' }}> Menu </div>
                    <Menu
                        theme="dark" mode="inline"
                        selectedKeys={getSelectedKey() ? [getSelectedKey()] : []}
                        onClick={({ key }) => {
                            if (key === '1') navigate('/');
                            else if (key === '2') navigate('/teams');
                            else if (key === '3') navigate('/setup-match');
                            else if (key === '4') navigate('/team-matches');
                            else if (key === '5') navigate('/rankings');
                        }}
                        items={menuItems}
                    />
                </Sider>
            )}

            {/* Inner Layout */}
            <Layout>
                <Header style={{ background: '#fff', paddingLeft: '20px', borderBottom: '1px solid #f0f0f0' }}>
                    <Title level={3} style={{ margin: '16px 0', lineHeight: '32px' }}> Table Tennis Tournament Scoreboard </Title>
                </Header>

                {/* Main Content Area */}
                <Content style={{
                    margin: '24px 16px 0',
                    padding: isScoreboardRoute ? 0 : 24,
                    background: '#fff',
                    minHeight: 280,
                }}>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <Space direction="vertical" size="large" style={{ display: 'flex', width: '100%' }}>
                                    <PlayerForm onPlayerAdded={handlePlayerAdded} />
                                    {/* Render PLAYER list, passing correct props */}
                                    <PlayerList
                                        players={players}
                                        loading={loadingPlayers}
                                        error={errorPlayers}
                                        title="All Players"
                                    />
                                </Space>
                            }
                        />
                        {/* --- Teams Management Route --- */}
                        <Route
                            path="/teams"
                            element={
                                <Space direction="vertical" size="large" style={{ display: 'flex', width: '100%' }}>
                                    <TeamForm onTeamCreated={handleTeamCreated} />
                                    <TeamList teams={teams} loading={loadingTeams} error={errorTeams} title="Registered Teams" />
                                </Space>
                            }
                        />
                        {/* Match Setup & Lists Route */}
                        <Route
                            path="/setup-match"
                            element={
                                <Space direction="vertical" size="large" style={{ display: 'flex', width: '100%' }}>
                                    <MatchSetupForm onMatchCreated={handleMatchCreated} />
                                    <MatchList key={`upcoming-${matchListVersion}`} status="Upcoming" title="Upcoming Matches" />
                                    <MatchList key={`live-${matchListVersion}`} status="Live" title="Live Matches" />
                                    <MatchList key={`finished-${matchListVersion}`} status="Finished" title="Finished Matches" />
                                </Space>
                            }
                        />
                        <Route
                            path="/team-matches" // Landing page for team matches
                            element={<TeamMatchesLanding />}
                        />
                        <Route
                            path="/team-matches/setup-set" // Page to setup a "Set" type team match
                            element={
                                <Space direction="vertical" size="large" style={{ display: 'flex', width: '100%' }}>
                                    <TeamSetMatchSetup onTeamMatchCreated={handleTeamMatchCreated} />
                                    <MatchList key={`upcoming-teamset-${matchListVersion}`} status="Upcoming" title="Upcoming Team Set Matches" matchTypeFilter="TeamSet" />
                                </Space>
                            }
                        />
                        <Route
                            path="/team-matches/setup-relay"
                            element={<TeamRelayMatchSetup onTeamMatchCreated={handleMatchCreated} />} // Use the imported component
                        />
                        {/* Scoreboard Route */}
                        <Route path="/match/:id/score" element={<Scoreboard />} />
                        {/* --- NEW Team Scoreboard Route --- */}
                        <Route path="/team-match/:id/score" element={<TeamScoreboard />} />
                        {/* Player Rankings Route */}
                        <Route path="/rankings" element={<PlayerRankings />} />
                    </Routes>
                </Content>

                <Footer style={{ textAlign: 'center', background: '#f0f2f5', padding: '15px 50px' }}>
                    Scoreboard App ©{new Date().getFullYear()}
                </Footer>
            </Layout>
        </Layout>
    );
}

export default App;