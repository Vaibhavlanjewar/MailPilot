import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const INITIAL_JOBS = [
  {
    id: 'JOB-9092',
    title: 'Senior Software Engineer (Fullstack)',
    company: 'Meta',
    location: 'London, UK (Abroad)',
    type: 'Hybrid',
    experience: 'Senior/Lead',
    salary: '£120,000 - £150,000',
    skills: ['React', 'Relay', 'GraphQL', 'PHP', 'System Design'],
    applyUrl: 'https://metacareers.com/jobs/9092',
    recruiterName: 'Elena Rostova',
    recruiterLinkedIn: 'https://linkedin.com/in/elena-rostova-recruiter-demo',
    description: 'Looking for a Senior Fullstack Engineer to drive core features on Facebook social platforms.',
    companySize: '500+',
    industry: 'Social Networking'
  },
  {
    id: 'JOB-7701',
    title: 'Backend Software Developer',
    company: 'Google',
    location: 'Bengaluru, India',
    type: 'On-site',
    experience: 'Mid-Level',
    salary: '₹28,00,000 - ₹38,00,000',
    skills: ['Go', 'Java', 'gRPC', 'Distributed Systems'],
    applyUrl: 'https://careers.google.com/jobs/7701',
    recruiterName: 'Amit Sharma',
    recruiterLinkedIn: 'https://linkedin.com/in/amit-sharma-recruiter-demo',
    description: 'Designing highly scaleable microservices for Next-Gen cloud API infrastructure.',
    companySize: '500+',
    industry: 'Cloud Computing'
  },
  {
    id: 'JOB-8422',
    title: 'Fullstack Architect',
    company: 'Stripe',
    location: 'Remote (Global)',
    type: 'Remote',
    experience: 'Senior/Lead',
    salary: '$140,000 - $185,000',
    skills: ['Ruby on Rails', 'React.js', 'PostgreSQL', 'AWS'],
    applyUrl: 'https://stripe.com/jobs/8422',
    recruiterName: 'Sarah Jenkins',
    recruiterLinkedIn: 'https://linkedin.com/in/sarah-jenkins-recruiter-demo',
    description: 'Lead next generation checkout widgets scaling down to latency-safe setups.',
    companySize: '500+',
    industry: 'Fintech'
  },
  {
    id: 'JOB-5109',
    title: 'Frontend Engineer (React)',
    company: 'Paytm',
    location: 'Noida, India',
    type: 'On-site',
    experience: 'Entry-Level',
    salary: '₹14,0,000 - ₹20,0,000',
    skills: ['JavaScript', 'React.js', 'Redux Toolkit', 'TailwindCSS'],
    applyUrl: 'https://careers.paytm.com/jobs/5109',
    recruiterName: 'Nisha Gupta',
    recruiterLinkedIn: 'https://linkedin.com/in/nisha-gupta-recruiter-demo',
    description: 'Help build user facing consumer wallets applications and checkout workflows.',
    companySize: '50-500',
    industry: 'E-commerce'
  },
  {
    id: 'JOB-2287',
    title: 'Cloud DevOps Architect',
    company: 'Amazon',
    location: 'Pune, India',
    type: 'Hybrid',
    experience: 'Senior/Lead',
    salary: '₹22,00,000 - ₹32,0,000',
    skills: ['AWS', 'Kubernetes', 'Terraform', 'Docker', 'CI/CD'],
    applyUrl: 'https://amazon.jobs/2287',
    recruiterName: 'Pranav Joshi',
    recruiterLinkedIn: 'https://linkedin.com/in/pranav-joshi-recruiter-demo',
    description: 'Maintain secure global landing zones for AWS computing layers.',
    companySize: '500+',
    industry: 'Cloud Infrastructure'
  },
  {
    id: 'JOB-3129',
    title: 'Node.js Backend Engineer',
    company: 'Microsoft',
    location: 'Hyderabad, India',
    type: 'Hybrid',
    experience: 'Mid-Level',
    salary: '₹20,00,000 - ₹28,00,000',
    skills: ['Node.js', 'Express', 'CosmosDB', 'TypeScript'],
    applyUrl: 'https://careers.microsoft.com/jobs/3129',
    recruiterName: 'Deepak Reddy',
    recruiterLinkedIn: 'https://linkedin.com/in/deepak-reddy-recruiter-demo',
    description: 'Develop integrations for cloud tools utilizing Serverless framework paradigms.',
    companySize: '500+',
    industry: 'Enterprise Software'
  },
  {
    id: 'JOB-1021',
    title: 'MERN Stack Developer',
    company: 'Tata Consultancy Services',
    location: 'Mumbai, India',
    type: 'Hybrid',
    experience: 'Entry-Level',
    salary: '₹8,00,000 - ₹12,0,000',
    skills: ['MongoDB', 'Express', 'React', 'Node.js'],
    applyUrl: 'https://tcs.com/careers/1021',
    recruiterName: 'Ritu Mehta',
    recruiterLinkedIn: 'https://linkedin.com/in/ritu-mehta-recruiter-demo',
    description: 'Collaborate with global banking clients to port legacy Java dashboards to React portals.',
    companySize: '500+',
    industry: 'Consulting'
  }
];

export default function JobSearch() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  
  // Custom filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedType, setSelectedType] = useState('All'); // All, Remote, Hybrid, On-site
  const [selectedExperience, setSelectedExperience] = useState('All'); // All, Entry-Level, Mid-Level, Senior/Lead
  const [selectedCompanySize, setSelectedCompanySize] = useState('All'); // All, 1-50, 50-500, 500+
  const [selectedSkills, setSelectedSkills] = useState([]); // Selected tech stack chips

  // Locations list
  const [locations, setLocations] = useState(['All', 'Mumbai', 'Pune', 'Hyderabad', 'Bengaluru', 'Noida', 'Abroad', 'Remote']);
  const [newLocationInput, setNewLocationInput] = useState('');

  // Sourced Crawler States
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlLogs, setCrawlLogs] = useState([]);

  // Popular stack chips to filters
  const POPULAR_SKILLS = ['React', 'React.js', 'Node.js', 'JavaScript', 'Go', 'Python', 'AWS', 'Kubernetes', 'Java', 'Terraform'];

  useEffect(() => {
    // Load default jobs + any custom recruiter posted jobs from local storage
    const savedString = localStorage.getItem('mailpilot_custom_jobs');
    let custom = [];
    if (savedString) {
      try {
        custom = JSON.parse(savedString);
      } catch (e) {
        custom = [];
      }
    }
    
    // Merge list, prioritizing newer recruiter custom jobs first
    setJobs([...custom, ...INITIAL_JOBS]);
  }, []);

  const handleAddLocation = (e) => {
    e.preventDefault();
    const formatted = newLocationInput.trim();
    if (!formatted) return;
    if (locations.map(l => l.toLowerCase()).includes(formatted.toLowerCase())) {
      toast.info(`Location "${formatted}" matches existing filters.`);
      setNewLocationInput('');
      return;
    }
    setLocations([...locations, formatted]);
    setSelectedLocation(formatted);
    setNewLocationInput('');
    toast.success(`Inserted "${formatted}" to location tag list.`);
  };

  const toggleSkillChip = (skill) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const startCrawlerSimulation = () => {
    if (isCrawling) return;
    setIsCrawling(true);
    setCrawlLogs([]);

    const companies = ['Google Careers API', 'LinkedIn Jobs Feed', 'Naukri.com Sorter', 'Corporate Feeds Portal'];
    let step = 0;

    const interval = setInterval(() => {
      if (step < companies.length) {
        const sourceName = companies[step];
        setCrawlLogs((prev) => [...prev, `[Crawl-Parser] Querying active listings on ${sourceName}...`]);
        setTimeout(() => {
          setCrawlLogs((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = `[Success] Pulled matches from ${sourceName} successfully!`;
            return copy;
          });
        }, 500);
        step++;
      } else {
        clearInterval(interval);
        const crawledResults = [
          {
            id: `RAW-${Math.floor(1000 + Math.random() * 9000)}`,
            title: 'Lead AI Engineer',
            company: 'Google',
            location: 'Bengaluru, India',
            type: 'On-site',
            experience: 'Senior/Lead',
            salary: '₹55,0,000 - ₹75,0,000',
            skills: ['Python', 'PyTorch', 'TensorFlow', 'JAX'],
            applyUrl: 'https://careers.google.com',
            recruiterName: 'Ananya Deshmukh',
            recruiterLinkedIn: 'https://linkedin.com',
            companySize: '500+',
            industry: 'Artificial Intelligence',
            description: 'Scraped from Careers Google. Drive core LLM evaluation for language search systems.'
          },
          {
            id: `RAW-${Math.floor(1000 + Math.random() * 9000)}`,
            title: 'Senior Devops Platform specialist',
            company: 'Stripe',
            location: 'Remote (Global)',
            type: 'Remote',
            experience: 'Senior/Lead',
            salary: '$150,000 - $190,000',
            skills: ['AWS', 'Kubernetes', 'Go', 'Terraform'],
            applyUrl: 'https://stripe.com/jobs',
            recruiterName: 'Sarah Jenkins',
            recruiterLinkedIn: 'https://linkedin.com',
            companySize: '500+',
            industry: 'Fintech',
            description: 'Scraped from Stripe Jobs. Managing automated production infrastructure deployment cycles.'
          }
        ];
        
        // Save to current state
        setJobs(prev => [...crawledResults, ...prev]);
        setIsCrawling(false);
        toast.success('Successfully scraped job feeds! 2 match-optimized roles added.');
      }
    }, 1000);
  };

  const handleQuickContact = (recruiter, jobTitle) => {
    toast.success(`Opening LinkedIn message template for ${recruiter} (applying for ${jobTitle})`);
  };

  // Big complex filtering system
  const filteredJobs = jobs.filter((job) => {
    // 1. Keyword search (Title, Company, Description)
    const matchesSearch =
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    // 2. Location badge
    let matchesLocation = true;
    if (selectedLocation !== 'All') {
      const parentLoc = job.location.toLowerCase();
      const filterLoc = selectedLocation.toLowerCase();
      matchesLocation = parentLoc.includes(filterLoc);
    }

    // 3. Workplace Mode Type (Remote, Hybrid, Onsite)
    const matchesType = selectedType === 'All' || job.type === selectedType;

    // 4. Experience Level
    const matchesExperience = selectedExperience === 'All' || job.experience === selectedExperience;

    // 5. Company Size
    const matchesCompanySize = selectedCompanySize === 'All' || job.companySize === selectedCompanySize;

    // 6. Selected stack chips (AND condition - must match all toggled chips if any are selected)
    let matchesSkills = true;
    if (selectedSkills.length > 0) {
      matchesSkills = selectedSkills.every(skill => 
        job.skills.map(s => s.toLowerCase()).includes(skill.toLowerCase())
      );
    }

    return matchesSearch && matchesLocation && matchesType && matchesExperience && matchesCompanySize && matchesSkills;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Header Panel */}
      <div className="rounded-2xl bg-gradient-to-r from-teal-700 via-emerald-600 to-indigo-700 p-6 text-white shadow-lg md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">AI Recruiter Outreach Companion</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-teal-100 md:text-base">
            Discover target engineering roles categorized by top tech hubs. Secure contact details for hiring managers and generate custom application campaigns tailored via Gemini AI.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => navigate('/app/post-job')}
            className="rounded-xl bg-white text-teal-800 font-bold px-4 py-2.5 text-xs shadow-md hover:bg-neutral-100 transition whitespace-nowrap"
          >
            Post a Job (Recruiters)
          </button>
          <button
            onClick={startCrawlerSimulation}
            disabled={isCrawling}
            className="rounded-xl bg-teal-900 border border-teal-500/30 text-teal-100 font-bold px-4 py-2.5 text-xs shadow-md hover:bg-teal-950 transition disabled:opacity-50"
          >
            {isCrawling ? 'Crawling career sites...' : 'Crawl Live Openings'}
          </button>
        </div>
      </div>

      {/* Crawl Simulation Log Box */}
      {isCrawling || crawlLogs.length > 0 ? (
        <div className="rounded-2xl border border-teal-500/20 bg-slate-900 text-teal-400 p-4 font-mono text-xs shadow-inner space-y-1">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="font-bold flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500 animate-pulse" />
              Live Career Parser Console (LinkedIn / Naukri / Corporate sites)
            </span>
            <button onClick={() => setCrawlLogs([])} className="text-stone-400 hover:text-white">Clear</button>
          </div>
          {crawlLogs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
          {isCrawling && <div className="text-stone-500 italic animate-pulse">Aggregating matching JSON packets...</div>}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side Filters Bar */}
        <div className="lg:col-span-4 bg-app-surface border border-surface-border rounded-2xl p-5 shadow-sm space-y-6 self-start">
          <div className="flex justify-between items-center border-b border-surface-border pb-3">
            <h2 className="font-semibold text-app text-sm uppercase tracking-wider">Parameters & Filters</h2>
            <button 
              onClick={() => {
                setSelectedLocation('All');
                setSelectedType('All');
                setSelectedExperience('All');
                setSelectedCompanySize('All');
                setSelectedSkills([]);
                setSearchQuery('');
                toast.info('Cleared all job search filter parameters.');
              }}
              className="text-xs font-semibold text-primary hover:underline hover:opacity-90"
            >
              Reset Filters
            </button>
          </div>

          {/* Search bar */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-app-muted">Keyword Search</label>
            <div className="relative">
              <svg className="absolute left-3 top-3 h-4 w-4 text-app-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.604 10.604z" />
              </svg>
              <input
                type="text"
                className="block w-full rounded-xl border border-input-border bg-transparent py-2.5 pl-9 pr-3 text-sm text-app outline-none focus:border-primary"
                placeholder="Title, company, stack keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Experience level tabs */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Experience Level</label>
            <div className="grid grid-cols-2 gap-2">
              {['All', 'Entry-Level', 'Mid-Level', 'Senior/Lead'].map((exp) => (
                <button
                  key={exp}
                  onClick={() => setSelectedExperience(exp)}
                  className={`rounded-xl py-2 px-3 text-xs font-semibold text-center border transition ${
                    selectedExperience === exp
                      ? 'bg-primary border-primary text-white shadow-soft font-bold'
                      : 'bg-default-bg border-surface-border text-app-muted hover:text-app'
                  }`}
                >
                  {exp}
                </button>
              ))}
            </div>
          </div>

          {/* Workplace type Mode */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Work Place Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['All', 'Remote', 'Hybrid', 'On-site'].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`rounded-xl py-2 px-3 text-xs font-semibold text-center border transition ${
                    selectedType === type
                      ? 'bg-primary border-primary text-white shadow-soft font-bold'
                      : 'bg-default-bg border-surface-border text-app-muted hover:text-app'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Tech Stack Chips Filter */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Tech Stack Filter</label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {POPULAR_SKILLS.map((skill) => {
                const isActive = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    onClick={() => toggleSkillChip(skill)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                      isActive 
                        ? 'bg-primary/10 border-primary text-primary font-bold' 
                        : 'bg-default-bg border-surface-border text-app-muted hover:text-app'
                    }`}
                  >
                    {skill} {isActive && '✓'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Company Size */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Company Size</label>
            <div className="flex gap-2">
              {['All', '1-50', '50-500', '500+'].map((sz) => (
                <button
                  key={sz}
                  onClick={() => setSelectedCompanySize(sz)}
                  className={`flex-1 rounded-xl py-2 text-xs font-semibold text-center border transition ${
                    selectedCompanySize === sz
                      ? 'bg-primary border-primary text-white shadow-soft font-bold'
                      : 'bg-default-bg border-surface-border text-app-muted hover:text-app'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Location tag box */}
          <div className="border-t border-surface-border pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold uppercase tracking-wider text-app-muted">Job Location Hub</label>
              
              <form onSubmit={handleAddLocation} className="flex gap-1.5 items-center">
                <input
                  type="text"
                  className="rounded-lg border border-input-border bg-transparent px-2 py-1 text-xs text-app outline-none focus:border-primary w-24"
                  placeholder="e.g. Pune"
                  value={newLocationInput}
                  onChange={(e) => setNewLocationInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-primary hover:opacity-90 text-white rounded-lg px-2 py-1 text-xs font-bold transition whitespace-nowrap"
                >
                  + Add
                </button>
              </form>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {locations.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setSelectedLocation(loc)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition ${
                    selectedLocation.toLowerCase() === loc.toLowerCase()
                      ? 'bg-primary/10 border-primary text-primary font-bold'
                      : 'bg-default-bg border-surface-border text-app-muted hover:text-app'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Right Side Jobs List Grid */}
        <div className="lg:col-span-8 space-y-4">
          
          <div className="flex justify-between items-center text-xs font-semibold text-app-muted border-b border-surface-border pb-2">
            <span>SHOWING {filteredJobs.length} MATCHING ROLE{filteredJobs.length === 1 ? '' : 'S'}</span>
            <span>SORT: DEFAULT RECENT</span>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-app-muted bg-app-surface">
              <svg className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <h3 className="mt-4 text-sm font-semibold text-app">No jobs found matching these parameters</h3>
              <p className="mt-1 text-xs max-w-sm mx-auto leading-relaxed">
                Adjust the filters in the left panel or broaden your keyword queries to discover listings.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredJobs.map((job) => (
                <div key={job.id} className="flex flex-col justify-between rounded-2xl border border-surface-border bg-app-surface p-5 shadow-sm hover:shadow-md transition">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {job.id}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-teal-650 bg-teal-50 dark:bg-teal-950/20 px-2 py-0.5 rounded leading-none border border-teal-500/10">
                          {job.type}
                        </span>
                        {job.experience && (
                          <span className="text-[10px] uppercase font-bold text-purple-650 bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded leading-none border border-purple-500/10">
                            {job.experience}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <h3 className="text-base font-bold text-app leading-snug">{job.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{job.company}</span>
                        {job.companySize && (
                          <span className="text-[10px] text-app-muted">({job.companySize} Employees)</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-app-muted">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      <span>{job.location}</span>
                    </div>

                    <p className="mt-2 text-xs font-semibold text-app-muted">
                      Compensation: <span className="text-app">{job.salary}</span>
                    </p>

                    <p className="mt-3 text-xs text-app-muted line-clamp-3 leading-relaxed">
                      {job.description}
                    </p>

                    {/* Tech Skills Tags */}
                    <div className="mt-4 flex flex-wrap gap-1">
                      {job.skills.map((skill) => (
                        <span key={skill} className="rounded-md bg-stone-100 dark:bg-stone-850 text-[10px] px-2 py-0.5 text-app font-medium border border-surface-border">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-5 border-t border-surface-border pt-4 flex items-center justify-between gap-3">
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex-1 text-center rounded-xl bg-primary py-2 text-xs font-semibold text-white shadow-soft hover:opacity-90 transition"
                    >
                      Apply Here
                    </a>

                    <a
                      href={job.recruiterLinkedIn}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={() => handleQuickContact(job.recruiterName, job.title)}
                      className="flex items-center gap-1.5 rounded-xl border border-surface-border bg-default-bg px-3 py-2 text-xs font-semibold text-app-muted hover:text-primary transition"
                    >
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M22.23 0H1.77C.8 0 0 .77 0 1.72v20.56C0 23.23.8 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.2 0 22.23 0zM7.12 20.45H3.56V9h3.56v11.45zM5.34 7.43c-1.14 0-2.06-.92-2.06-2.06 0-1.14.92-2.06 2.06-2.06 1.14 0 2.06.92 2.06 2.06 0 1.14-.92 2.06-2.06 2.06zm15.11 13.02h-3.56v-5.6c0-1.34-.03-3.05-1.86-3.05-1.86 0-2.14 1.45-2.14 2.95v5.7h-3.56V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29z"/>
                      </svg>
                      <span>Chat Recruiter</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
